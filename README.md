# Power Pilot

A browser extension scaffold for Chrome and Edge that helps inspect Dynamics 365 / Power Platform metadata from the current page, including option sets and registered plug-ins.

## Install
1. Open Chrome or Edge.
2. Go to `chrome://extensions` or `edge://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked` and select the `Dynamics365LevelUpExtension` folder.

## How to use
1. Open a Dynamics 365 or Power Platform form page.
2. Click the extension icon.
3. Press `OPTION SET` to inspect option set values for the active form entity.
4. Press `PLUGIN EXPLORER` to inspect registered custom plug-in types, assemblies, steps, and step images.
5. Press `ENABLE FIELDS` to unlock disabled fields on the active form.
6. Press `DISABLE MANDATORY FIELDS` to convert Business Required fields to Optional.
7. Press `SHOW SCHEMA NAMES` to toggle field schema names on the active form.

## Supported pages
- `*.dynamics.com`
- `*.crm.dynamics.com`
- `*.powerapps.com`
- `*.dynamics.microsoft.com`
- `*.crm6.dynamics.com`

## Files
- `manifest.json` — extension metadata and permissions.
- `popup.html` — UI for the extension popup.
- `popup.js` — popup behavior and messaging.
- `content-script.js` — collects option set values from the Dynamics page.
