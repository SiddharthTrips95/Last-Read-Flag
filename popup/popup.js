function activeTab() {
    return chrome.tabs.query({ active: true, currentWindow: true }).then(t =>
        t[0]);
}
async function getStore() {
    const DEFAULT_SETTINGS = {
        useSync: true, autoSave: true,
        autoScrollOnLoad: true
    };
    const r = await chrome.storage.sync.get({
        'lrf:settings':
            DEFAULT_SETTINGS
    });
    const s = r['lrf:settings'] || DEFAULT_SETTINGS;
    return s.useSync ? chrome.storage.sync : chrome.storage.local;
}
function pageKeyFromUrl(urlStr) {
    const url = new URL(urlStr);
    url.hash = '';
    url.search = '';
    return `lrf:${url.origin}${url.pathname}`;
}
function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString();
}
async function render() {
    const tab = await activeTab();
    const key = pageKeyFromUrl(tab.url);
    const store = await getStore();
    const data = (await store.get(key))[key];
    const list = document.getElementById('markers');
    const status = document.getElementById('status');
    list.innerHTML = '';
    if (!data || !data.markers?.length) {
        status.textContent = 'No markers saved for this page yet.';
        return;
    }
    status.textContent = '';
    const markers = data.markers;
    markers.slice().reverse().forEach(m => {
        const li = document.createElement('li');
        const title = document.createElement('span');
        title.className = 'title';
        title.textContent = `${m.type === 'manual' ? 'Manual' : 'Auto'} • $
{m.title || ''}`;
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = `${fmtTime(m.createdAt)} — “${(m.snippet ||
            '').slice(0, 80)}${(m.snippet || '').length > 80 ? '…' : ''}”`;
        const open = document.createElement('button');
        open.textContent = 'Jump';
        open.addEventListener('click', () => chrome.tabs.sendMessage(tab.id, {
            type: 'jumpToLast'
        }));
        li.appendChild(title); li.appendChild(meta); li.appendChild(open);
        list.appendChild(li);
    });
}
async function init() {
    document.getElementById('drop').addEventListener('click', async () => {
        const tab = await activeTab();
        chrome.tabs.sendMessage(tab.id, { type: 'saveManual' });
        window.close();
    });
    document.getElementById('jump').addEventListener('click', async () => {
        const tab = await activeTab();
        chrome.tabs.sendMessage(tab.id, { type: 'jumpToLast' });
        window.close();
    });
    document.getElementById('clear').addEventListener('click', async () => {
        const tab = await activeTab();
        chrome.tabs.sendMessage(tab.id, { type: 'clearMarkers' });
        window.close();
    });
    document.getElementById('openOptions').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
    await render();
}
document.addEventListener('DOMContentLoaded', init);