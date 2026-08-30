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
8. Click `Submit Feedback / Issues` at the bottom of the popup to report bugs or submit feature requests on GitHub.

## Feedback & Issues
Found a bug or have a suggestion? Submit an issue directly on GitHub:
[New Issue / Feedback](https://github.com/sathishkannan-git/POWER_PILOT/issues/new/choose)

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



Power Pilot is a productivity and debugging tool designed for Microsoft Dynamics 365, Power Apps, and Microsoft Dataverse developers, functional consultants, administrators, and QA testers.

Accelerate form inspections, troubleshooting, and metadata discovery directly inside your model-driven apps without navigating through complex backend settings.

----------------------------------------------------------------
🚀 KEY FEATURES
----------------------------------------------------------------

⚡ FORM & FIELD PRODUCTIVITY
• Show Schema Names: Toggle and overlay logical/schema names directly on form labels for rapid scripting and API development.
• Unlock Disabled Fields: Instantly enable read-only or system-locked fields to test updates and integrations.
• Disable Mandatory Requirements: Switch business-required fields to optional on the fly for testing data entry without validation blockers.
• Reveal Hidden Fields: Unhide invisible tabs, sections, and form controls.

🔍 OPTION SET INSPECTOR
• Extract and review all Option Sets, Choices, and Multi-Select picklists for the active entity.
• Search and filter choice labels and integer underlying values in real time.
• One-click export and clipboard copy for rapid documentation and development.

🧩 PLUGIN EXPLORER
• Browse custom and Out-of-the-Box (OOB) plug-in types, assemblies, steps, and step images.
• Deep-dive into execution pipelines, messages, stages, execution order, filtering attributes, and registered entities.
• Quickly identify active plug-in triggers and troubleshoot custom logic errors.

🎯 DEVELOPER-FIRST USER INTERFACE
• Clean, modern, and compact flyout interface.
• Instant search & filtering across options, plugins, and entity metadata.
• Multi-entity selector support.

----------------------------------------------------------------
💼 WHO IS THIS FOR?
----------------------------------------------------------------
• Dynamics 365 Developers building JavaScript Web Resources, Plugins, and Power Automate Flows.
• Functional Consultants configuring forms, business rules, and choice fields.
• QA & Testers verifying field behavior, validation states, and pipeline executions.
• System Administrators managing complex Dataverse and CRM solutions.

----------------------------------------------------------------
🔒 PRIVACY & SECURITY
----------------------------------------------------------------
• Client-Side Execution: All operations run locally within your browser context using your existing session permissions.
• Zero Data Collection: Power Pilot does not track, collect, store, or transmit your business data or telemetry to external third-party servers.

----------------------------------------------------------------
🌐 SUPPORTED PLATFORMS
----------------------------------------------------------------
Works seamlessly across all modern Dynamics 365 and Dataverse model-driven app environments:
• *.dynamics.com
• *.crm.dynamics.com
• *.powerapps.com
