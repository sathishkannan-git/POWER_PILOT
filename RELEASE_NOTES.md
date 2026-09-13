# Power Pilot v1.1.0 Release Notes

**Release Date:** September 13, 2026  
**Version:** 1.1.0  
**Manifest Version:** V3  

Power Pilot v1.1.0 brings a major feature expansion tailored for Microsoft Dynamics 365, Power Apps, and Microsoft Dataverse developers, administrators, and consultants. This release introduces **Entity Management**, comprehensive **Metadata Export to Excel**, and **User Security Roles Inspection** directly within the extension popup.

---

## 🚀 What's New in v1.1.0

### 1. ⚡ Entity Management
- **Entity Info**:
  - One-click inspection of the active entity definition: **Schema Name**, **Logical Name**, **Display Name**, **Object Type Code (ETC)**, **Primary ID Attribute**, and **Primary Name Attribute**.
  - Direct clipboard copy of schema and logical names for instant use in JavaScript web resources and Power Automate flows.
- **Record ID**:
  - Instantly captures and formats the active record GUID (both clean raw GUID `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` and formatted GUID `{XXXXXXXX-...}`).
  - Captures record title and direct record URL.
  - Clear indication for unsaved new records.
- **Top Interactive Status Bar**:
  - Relocated directly beneath the ENTITY dropdown for prominent visibility.
  - Features instant **click-to-copy** functionality with visual copy icons and animated `"Copied!"` feedback.

---

### 2. 📊 Export Metadata (Excel .xlsx)
- **Fields Export**:
  - Exports all fields defined on the active entity (not just fields placed on the current form) into an Excel workbook (`.xlsx`).
  - Columns exported: `Display Name`, `Schema Name`, and `Data Type`.
  - Automated timestamped filename: `<EntityName>_Fields_<YYYYMMDD_HHMMSS>.xlsx`.
- **Entity Export**:
  - Exports comprehensive entity metadata properties into an Excel workbook (`.xlsx`), including Schema Name, Logical Name, Ownership Type, Object Type Code, Custom Entity flag, and timestamps.
  - Automated timestamped filename: `<EntityName>_Entity_Metadata_<YYYYMMDD_HHMMSS>.xlsx`.
- **Auto-Close**:
  - Automatically closes the extension popup 500ms after initiating an export, allowing users to return immediately to their CRM screen.

---

### 3. 🛡️ User Security Roles
- **Current User Security Roles Inspector**:
  - Instantly inspects and lists all security roles assigned to the currently logged-in user directly in the main popup inspector.
  - Displays user display name, user GUID, and total assigned role count badge.
- **Live Search & Filter**:
  - Real-time filtering across role names and GUIDs using the main search box.
- **Quick Copy & Export**:
  - **Individual Copy**: Instant one-click copy button per role with `"Copied!"` confirmation.
  - **Copy All**: Copies all security role names to the clipboard formatted with line breaks.
  - **Export Excel**: Exports the complete roles list (Role Name, Role ID, User Name, User ID) directly into an Excel workbook (`.xlsx`).
- **Multi-Source Dataverse Retrieval**:
  - Retrieves roles from `Xrm.Utility.getGlobalContext().userSettings.roles` (handling `ItemCollection`, array, and object implementations).
  - Robust fallback to `userSettings.securityRoleNames` and Dataverse Web API (`/api/data/v9.2/systemusers/systemuserroles_association`).

---

## 🛠️ Enhancements & Fixes
- **Refined Layout**: Clean section separation with dedicated sub-headers for *Entity Management*, *Form Management*, *Field Management*, *Export Metadata*, *User Security*, and *General Actions*.
- **Integrated SheetJS**: Embedded `lib/xlsx.full.min.js` for standalone, secure client-side Excel generation with zero external network requests.
- **Version Bump**: Updated `manifest.json` to version `1.1.0`.

---

## 📦 Installation & Deployment
1. Download **`Power-Pilot-v1.1.0.zip`** from the release assets.
2. Extract the `.zip` file into a local folder.
3. Open Google Chrome or Microsoft Edge and navigate to `chrome://extensions` (or `edge://extensions`).
4. Enable **Developer mode** toggle.
5. Click **Load unpacked** and select the extracted folder.
