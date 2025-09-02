const KEY = 'lrf:settings';
const DEFAULTS = { useSync: true, autoSave: true, autoScrollOnLoad: true };
async function load() {
    const r = await chrome.storage.sync.get({ [KEY]: DEFAULTS });
    const s = r[KEY] || DEFAULTS;
    document.getElementById('useSync').checked = !!s.useSync;
    document.getElementById('autoSave').checked = !!s.autoSave;
    document.getElementById('autoScrollOnLoad').checked = !!s.autoScrollOnLoad;
}
function save() {
    const s = {
        useSync: document.getElementById('useSync').checked,
        autoSave: document.getElementById('autoSave').checked,
        autoScrollOnLoad: document.getElementById('autoScrollOnLoad').checked
    };
    chrome.storage.sync.set({ [KEY]: s });
}
document.addEventListener('DOMContentLoaded', async () => {
    await load();
    document.body.addEventListener('change', save);
});