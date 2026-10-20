console.log("Starting the service worker");

const TC_BASE_URL = "https://teamcity.bmtapps.bskyb.com"
const AUTHENTICATION_TEST_PATH = "/authenticationTest.html"
const LOGIN_PATH = "/login.html"
const SSO_LOGIN_PATH = "/aadLogin.html"
const POST_LOGIN_PATH = "/overview.html"

const LISTENER_URL_PATTERN = TC_BASE_URL + "/*"
const AUTHENTICATION_TEST_URL = TC_BASE_URL + AUTHENTICATION_TEST_PATH
const LOGIN_URL = TC_BASE_URL + LOGIN_PATH
const SSO_LOGIN_URL = TC_BASE_URL + SSO_LOGIN_PATH
const POST_LOGIN_URL = TC_BASE_URL + POST_LOGIN_PATH


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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const url = changeInfo.url;
    if (url?.indexOf(TC_BASE_URL) === 0) {
        console.log(`In tab onUpdated [${tabId}], new URL is '${url}'`, changeInfo, tab);

        if (url.indexOf(AUTHENTICATION_TEST_URL) === -1 &&
            url.indexOf(LOGIN_URL) === -1 &&
            url.indexOf(SSO_LOGIN_URL) === -1 &&
            url.indexOf(POST_LOGIN_URL) === -1) {
            console.log("...will store this URL as a potential redirect URL in case TC sends us to the authentication test page")
            await setStoredRedirectUrl(tabId, url);
        } else {
            console.log("...will NOT store this URL")
        }
    }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
    await clearStoredRedirectUrl(tabId);
});

chrome.webRequest.onBeforeRedirect.addListener(async (details) => {
    await logState("BeforeRedirect", details);

    if (details.redirectUrl?.indexOf(LOGIN_URL) === 0) {
        if (details.url?.indexOf(AUTHENTICATION_TEST_URL) === 0) {
            console.log(`Detected that the original URL was the full-page authentication test, so won't store that as a redirect URL`);
        } else {
            console.log(`Storing the original URL (${details.url}) before our extension does a custom redirect to the AD login page`);
            await setStoredRedirectUrl(details.tabId, details.url);
        }

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
        } else {
            console.log("No URL in storage, so just visit the page as normal");
        }
    }
}, {urls: [POST_LOGIN_URL]});

console.log("Service worker setup complete");
