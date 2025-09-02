// background.js


function sendToActiveTab(message) {
    return chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        const tab = tabs[0];
        if (tab && tab.id) return chrome.tabs.sendMessage(tab.id, message);
    });
}


chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "lrf-save-marker",
        title: "Save reading marker here",
        contexts: ["page", "selection"]
    });
});


chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "lrf-save-marker" && tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "saveManual" });
    }
});


chrome.commands.onCommand.addListener(async (command) => {
    if (command === "drop_manual_marker") {
        await sendToActiveTab({ type: "saveManual" });
    } else if (command === "jump_to_last_marker") {
        await sendToActiveTab({ type: "jumpToLast" });
    }
});