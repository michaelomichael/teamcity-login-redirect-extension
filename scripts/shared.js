const DEFAULTS = {
    baseUrl: "https://your.team.city.server",
    enableAutoAadLogin: false,
};

async function getOptions() {
    return await chrome.storage.sync.get(DEFAULTS);
}

async function putOption(key, value) {
    await chrome.storage.sync.set({[key]: value});
}

function onOptionsChanged(callback) {
    chrome.storage.sync.onChanged.addListener(callback);
}