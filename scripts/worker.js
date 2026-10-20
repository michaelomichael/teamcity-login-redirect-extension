console.log("Starting the service worker");

importScripts('shared.js');

const AUTHENTICATION_TEST_PATH = "/authenticationTest.html"
const LOGIN_PATH = "/login.html"
const SSO_LOGIN_PATH = "/aadLogin.html"
const POST_LOGIN_PATH = "/overview.html"

function storageKeyForTab(tabId) {
    return `team_goldfish_redirect_url_for_tab_${tabId}`;
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

/**
 * Ideally, we should be able to get by if we just take the "referer" request header when a request
 * redirects to the login page. Unfortunately, when you switch tabs and re-activate a TeamCity tab,
 * it will navigate to /authenticationTest.html (without providing a "referer" header) and _that_
 * page will redirect to the login page. This means that, after login is complete, we will end up
 * forwarding the user to the /authenticationTest.html page!
 *
 * To get round this, we will watch for any changes to the tab's URL and store the new value
 * for later use.
 */
function teamCityPath(url, teamCityBaseUrl) {
    if (url?.indexOf(teamCityBaseUrl) === 0) {
        return url.substring(teamCityBaseUrl.length);
    }
    return null;
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const options = await getOptions();
    const baseUrl = options.baseUrl;
    const path = teamCityPath(changeInfo.url, baseUrl);

    if (path == null) return;

    console.log(`In tab onUpdated [${tabId}], new path is '${path}' and baseUrl is '${baseUrl}'`, changeInfo, tab);

    if (
        path.indexOf(AUTHENTICATION_TEST_PATH) === 0 ||
        path.indexOf(LOGIN_PATH) === 0 ||
        path.indexOf(SSO_LOGIN_PATH) === 0 ||
        path.indexOf(POST_LOGIN_PATH) === 0
    ) {
        console.log("...will NOT store this URL")
        return;
    }

    console.log("...will store this URL as a potential redirect URL in case TC sends us to the authentication test page")
    await setStoredRedirectUrl(tabId, changeInfo.url);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
    await clearStoredRedirectUrl(tabId);
});

async function interceptBeforeRedirect(details) {
    await logState("BeforeRedirect", details);

    const options = await getOptions();
    const baseUrl = options.baseUrl;
    const redirectPath = teamCityPath(details.redirectUrl, baseUrl);
    const originalPath = teamCityPath(details.url, baseUrl);

    if (redirectPath?.indexOf(LOGIN_PATH) !== 0) return;

    if (originalPath?.indexOf(AUTHENTICATION_TEST_PATH) === 0) {
        console.log(`Detected that the original URL was the full-page authentication test, so won't store that as a redirect URL`);
    } else {
        console.log(`Storing the original URL (${details.url}) before login process starts`);
        await setStoredRedirectUrl(details.tabId, details.url);
    }

    if (options.enableAutoAadLogin) {
        console.log("Automatically forwarding to the Azure Active Directory login page");
        await setTabUrl(details.tabId, `${baseUrl}${SSO_LOGIN_PATH}`);
    }
}

async function interceptOnCompleted(details) {
    await logState("Completed", details);
    if (details.type === "main_frame" && details.method !== "OPTIONS") {
        // We've been redirected to the 'old' welcome page
        // Note: if we try to do the next bit in `onBeforeRequest` then we'll end up in an infinite loop,
        // presumably because we've not yet completed sending the auth token to the server?
        const redirectUrl = await getStoredRedirectUrl(details.tabId);
        if (redirectUrl == null) {
            console.log("No URL in storage, so just visit the page as normal");
            return
        }

        // Navigate back to the page that the user had originally tried to visit
        await setTabUrl(details.tabId, redirectUrl);
    }
}

async function recreateListeners() {
    const options = await getOptions();
    const baseUrl = options.baseUrl;

    console.log("Recreating listeners. BaseUrl is:", baseUrl);

    const listenerUrlPattern = `${baseUrl}/*`;
    const postLoginUrl = `${baseUrl}${POST_LOGIN_PATH}`;

    chrome.webRequest.onBeforeRedirect.removeListener(interceptBeforeRedirect);
    chrome.webRequest.onBeforeRedirect.addListener(interceptBeforeRedirect, {urls: [listenerUrlPattern]});

    chrome.webRequest.onCompleted.removeListener(interceptOnCompleted);
    chrome.webRequest.onCompleted.addListener(interceptOnCompleted, {urls: [postLoginUrl]});
}

onOptionsChanged(recreateListeners);

recreateListeners().then(() => {
    console.log("Service worker setup complete");
});

