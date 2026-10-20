console.log("Starting the service worker");

const BASE_URL = "https://teamcity.bmtapps.bskyb.com"
const LOGIN_PATH = "/login.html"
const SSO_LOGIN_PATH = "/aadLogin.html"
const POST_LOGIN_PATH = "/overview.html"

const LISTENER_URL_PATTERN = BASE_URL + "/*"
const LOGIN_URL = BASE_URL + LOGIN_PATH
const SSO_LOGIN_URL = BASE_URL + SSO_LOGIN_PATH
const POST_LOGIN_URL = BASE_URL + POST_LOGIN_PATH


function storageKeyForTab(tabId) {
    return `mo_redirect_url_for_tab_${tabId}`;
}

async function getStoredRedirectUrl(tabId) {
    const key = storageKeyForTab(tabId);
    return (await chrome.storage.local.get(key))[key];
}

async function setStoredRedirectUrl(tabId, url) {
    const key = storageKeyForTab(tabId);
    await chrome.storage.local.set({[key]: url});
}

async function clearStoredRedirectUrl(tabId) {
    console.log("Clearing stored redirect url for tab id", tabId);
    const key = storageKeyForTab(tabId);
    await chrome.storage.local.remove(key);
}

async function logState(methodName, details) {
    const currentStoredRedirectUrl = await getStoredRedirectUrl(details.tabId);
    console.log(`📸 ${methodName}: type is ${details.type}, tabId is ${details.tabId}, current redirectUrl is [${currentStoredRedirectUrl}]`, details);
}

async function setTabUrl(tabId, url) {
    console.log(`About to set URL of tab id ${tabId} to ${url}`);
    await chrome.tabs.update(tabId, {"url": url});
}

chrome.webRequest.onBeforeRedirect.addListener(async (details) => {
    await logState("BeforeRedirect", details);
    if (details.redirectUrl?.indexOf(LOGIN_URL) === 0) {
        console.log(`Storing the original URL (${details.url}) before our extension does a custom redirect to the AD login page`);
        // TODO: If details.url is the /authenticationTest.html page then we need to find out what the last sensible page
        // was _before_ that.
        await setStoredRedirectUrl(details.tabId, details.url);
        await setTabUrl(details.tabId, SSO_LOGIN_URL);
    }
}, {urls: [LISTENER_URL_PATTERN]});

chrome.webRequest.onCompleted.addListener(async (details) => {
    await logState("Completed", details);
    if (details.type === "main_frame" && details.method !== "OPTIONS") {
        // We've been redirected to the 'old' welcome page
        // Note: if we try to do the next bit in `onBeforeRequest` then we'll end up in an infinite loop,
        // presumably because we've not yet completed sending the auth token to the server?
        const redirectUrl = await getStoredRedirectUrl(details.tabId)
        if (redirectUrl) {
            await setTabUrl(details.tabId, redirectUrl);
            await clearStoredRedirectUrl(details.tabId);
        } else {
            console.log("No URL in storage, so just visit the page as normal");
        }
    }
}, {urls: [POST_LOGIN_URL]});

console.log("Service worker setup complete");
