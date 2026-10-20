# TeamGoldfish

![TeamGoldfish](icons/icon.svg)

A browser extension for Google Chrome that returns you to the original page in TeamCity
when Azure Active Directory login is completed.

It can also automatically click the "Log in using Azure Active Directory" link for you when
the `/login.html` page is displayed.


## Installation
First time:
1. Clone this repository.
2. Open Chrome and paste the following into the address bar: `chrome://extensions/`.
3. Click the "Load Unpacked" button and select the `teamcity-login-redirect-extension` folder that you just cloned.

Or if it's already installed, and you want to pick up the latest changes:
1. Do a regular `git pull`.
2. Open chrome and go to `chrome://extensions/`.
3. Find the "TeamGoldfish: TeamCity Redirect Extension" extension and click the `↻` "Reload" icon.
4. 