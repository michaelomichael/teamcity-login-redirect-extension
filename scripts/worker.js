console.log("Starting the service worker");

function storageKeyForTab(tabId) {
	return `mo_redirect_url_for_tab_${tabId}`;
}

async function getStoredRedirectUrl(tabId) {
	const key = storageKeyForTab(tabId);
	return (await chrome.storage.local.get(key))[key];
}

async function setStoredRedirectUrl(tabId, url) {
	const key = storageKeyForTab(tabId);
	chrome.storage.local.set({[key]: url});
}

async function clearStoredRedirectUrl(tabId) {
	const key = storageKeyForTab(tabId);
	chrome.storage.local.remove(key);
}

async function logState(methodName, details) {
	const currentStoredRedirectUrl = await getStoredRedirectUrl(details.tabId);
	console.log(`XXX ${methodName}: type is ${details.type}, tabId is ${details.tabId}, current redirectUrl is [${currentStoredRedirectUrl}]`, details);
}

async function setTabUrl(tabId, url) {
	console.log(`About to redirect tab id ${tabId} to ${url}`);
	chrome.tabs.update(tabId, { "url": url });
}

chrome.webRequest.onBeforeRedirect.addListener((details) => {
		logState("BeforeRedirect", details);
		if (details.redirectUrl === "https://teamcity.bmtapps.bskyb.com/login.html") {
			console.log(`Storing the original URL (${details.url}) before redirecting to the AD login page`);
			setStoredRedirectUrl(details.tabId, details.url);
			setTabUrl(details.tabId, "https://teamcity.bmtapps.bskyb.com/aadLogin.html");
		}
	}, { urls: ["https://teamcity.bmtapps.bskyb.com/*"]});

chrome.webRequest.onCompleted.addListener((details) => {
		logState("Completed", details);
		if (details.type === "main_frame"  &&  details.method !== "OPTIONS") {
			// We've been redirected to the 'old' welcome page
			// Note: if we try to do the next bit in `onBeforeRequest` then we'll end up in an infinite loop, 
			// presumably because we've not yet completed sending the auth token to the server?
			getStoredRedirectUrl(details.tabId).then((redirectUrl) => {
				if (redirectUrl) {
					setTabUrl(details.tabId, redirectUrl);
					clearStoredRedirectUrl(details.tabId);
				} else {
					console.log("No URL in storage, so just visit the page as normal");
				}
			});
		}
	}, { urls: ["https://teamcity.bmtapps.bskyb.com/overview.html"]});

console.log("Service worker setup complete");
