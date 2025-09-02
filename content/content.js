// content/content.js
const LRF = (() => {
    const SETTINGS_KEY = 'lrf:settings';
    const DEFAULT_SETTINGS = {
        useSync: true, autoSave: true,
        autoScrollOnLoad: true
    };
    let settings = DEFAULT_SETTINGS;
    let lastRenderedId = null;
    let scrollSaveTimer = null;
    // ---------- storage helpers ----------
    async function getSettings() {
        const r = await chrome.storage.sync.get({
            [SETTINGS_KEY]:
                DEFAULT_SETTINGS
        });
        settings = r[SETTINGS_KEY] || DEFAULT_SETTINGS;
        return settings;
    }
    async function getStore() {
        const s = await getSettings();
        return s.useSync ? chrome.storage.sync : chrome.storage.local;
    }
    function pageKey(u = location.href) {
        const url = new URL(u);
        url.hash = '';
        url.search = '';
        return `lrf:${url.origin}${url.pathname}`;
    }
    // ---------- DOM anchoring ----------
    function elAtViewportCenter() {
        const x = Math.max(0, Math.floor(window.innerWidth / 2));
        const y = Math.max(0, Math.floor(window.innerHeight / 2));
        return document.elementFromPoint(x, y) || document.body;

    }
    function closestBlock(el) {
        if (!el) return document.body;
        return el.closest('p, article, section, li, h1, h2, h3, h4, pre, code, blockquote, main, div') || el;
    }


    function cssPath(el) {
        if (!(el instanceof Element)) return '';
        const path = [];
        while (el && el.nodeType === Node.ELEMENT_NODE && path.length < 20) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
                selector += `#${CSS.escape(el.id)}`;
                path.unshift(selector);
                break;
            } else {
                // add nth-child for uniqueness
                const parent = el.parentNode;
                if (!parent) break;
                const siblings = Array.from(parent.children).filter(n => n.nodeName
                    === el.nodeName);
                const index = siblings.indexOf(el) + 1;
                if (siblings.length > 1) selector += `:nth-of-type(${index})`;
                path.unshift(selector);
                el = parent;
            }
        }
        return path.join('>');
    }
    function snippet(el, max = 160) {
        const t = (el?.textContent || '').replace(/\s+/g, ' ').trim();
        return t.slice(0, max);
    }
    function djb2(str) {
        let h = 5381;
        for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
        return (h >>> 0).toString(36);
    }
    function buildMarker(el, type = 'auto') {
        const target = closestBlock(el);
        const s = snippet(target);
        return {
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,
                8)}`,
            type, // 'auto' | 'manual'
            selector: cssPath(target),
            snippet: s,
            hash: djb2(s),
            scrollY: window.scrollY,
            createdAt: Date.now(),
            title: document.title
        };
    }
    function byBestPriority(markers = []) {
        if (!markers.length) return null;
        // Prefer last manual, else last auto
        const manual = markers.filter(m => m.type === 'manual').pop();
        return manual || markers.filter(m => m.type === 'auto').pop();
    }
    function tryResolve(marker) {
        if (!marker) return null;
        // 1) selector
        if (marker.selector) {
            try {
                const el = document.querySelector(marker.selector);
                if (el) return el;
            } catch (_) { }
        }
        // 2) snippet search
        if (marker.snippet) {
            const candidates =
                Array.from(document.querySelectorAll('p,li,article,section,div,h1,h2,h3,h4,pre,code,blockquote'));
            const sn = marker.snippet.slice(0, 40);
            const el = candidates.find(e => (e.textContent || '').replace(/\s+/g,
                ' ').includes(sn));
            if (el) return el;
        }
        // 3) fallback to scrollY only
        return null;
    }
    function clearRendered() {
        document.querySelectorAll('.lrf-target').forEach(el =>
            el.classList.remove('lrf-target'));
        lastRenderedId = null;
    }
    function renderMarker(el, marker) {
        if (!el) return;
        clearRendered();
        el.classList.add('lrf-target');
        el.setAttribute('data-lrf-id', marker.id);
        lastRenderedId = marker.id;
        ensureJumpButton();
    }

    function ensureJumpButton() {
        if (document.getElementById('lrf-jump')) return;
        const btn = document.createElement('button');
        btn.id = 'lrf-jump';
        btn.className = 'lrf-floating-btn';
        btn.textContent = 'Jump to marker';
        btn.addEventListener('click', () => jumpToLast());
        document.documentElement.appendChild(btn);
    }
    async function saveMarker(type = 'auto') {
        const store = await getStore();
        const key = pageKey();
        const existing = (await store.get(key))[key] || {
            markers: [],
            lastUpdated: 0
        };
        const baseEl = window.getSelection()?.anchorNode?.nodeType === 3 ?
            window.getSelection().anchorNode.parentElement : null;
        const el = type === 'manual' ? (baseEl || elAtViewportCenter()) :
            elAtViewportCenter();
        const marker = buildMarker(el, type);
        if (type === 'auto') {
            // keep only one auto marker
            existing.markers = existing.markers.filter(m => m.type !== 'auto');
        }
        existing.markers.push(marker);
        existing.lastUpdated = Date.now();
        await store.set({ [key]: existing });
        renderMarker(el, marker);
    }
    async function loadAndRender(scrollIntoView = true) {
        const [store, s] = await Promise.all([getStore(), getSettings()]);
        const key = pageKey();
        const data = (await store.get(key))[key];
        if (!data) return;
        const marker = byBestPriority(data.markers);
        if (!marker) return;
        const el = tryResolve(marker);
        if (el) {
            if (s.autoScrollOnLoad && scrollIntoView) {
                el.scrollIntoView({ behavior: 'instant', block: 'center' });
            }
            renderMarker(el, marker);
        } else if (typeof marker.scrollY === 'number') {
            window.scrollTo({ top: marker.scrollY, behavior: 'instant' });
            // try again after layout
            setTimeout(() => loadAndRender(false), 50);

        }
    }
    function throttleSave() {
        if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
        scrollSaveTimer = setTimeout(() => saveMarker('auto'), 600);
    }
    async function jumpToLast() {
        const store = await getStore();
        const key = pageKey();
        const data = (await store.get(key))[key];
        if (!data) return;
        const marker = byBestPriority(data.markers);
        if (!marker) return;
        const el = tryResolve(marker);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            renderMarker(el, marker);
        } else if (typeof marker.scrollY === 'number') {
            window.scrollTo({ top: marker.scrollY, behavior: 'smooth' });
        }
    }
    async function clearMarkers() {
        const store = await getStore();
        const key = pageKey();
        await store.remove(key);
        clearRendered();
        const btn = document.getElementById('lrf-jump');
        if (btn) btn.remove();
    }
    // ----- SPA URL changes -----
    (function patchHistory() {
        const _push = history.pushState;
        const _replace = history.replaceState;
        function wrapped(fn) {
            return function () {
                const rv = fn.apply(this, arguments);
                setTimeout(() => loadAndRender(false), 0);
                return rv;
            };
        }
        history.pushState = wrapped(_push);
        history.replaceState = wrapped(_replace);
        window.addEventListener('popstate', () => loadAndRender(false));
        window.addEventListener('hashchange', () => loadAndRender(false));
    })();
    // ---------- event wiring ----------

    window.addEventListener('scroll', () => {
        if (settings.autoSave) throttleSave();
    }, { passive: true });
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === 'saveManual') saveMarker('manual');
        if (msg?.type === 'jumpToLast') jumpToLast();
        if (msg?.type === 'clearMarkers') clearMarkers();
    });
    // init
    (async function init() {
        await getSettings();
        loadAndRender(true);
    })();
    // public (used by popup)
    return { pageKey, getStore, byBestPriority };
})();