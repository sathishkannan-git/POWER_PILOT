const POPUP_WIDTH = 380;
applyPopupFrameSizing();

const statusElement = document.getElementById('status');
const resultsElement = document.getElementById('results');
const errorsElement = document.getElementById('errors');
const entitySelect = document.getElementById('entitySelect');
const refreshButton = document.getElementById('refreshButton');
const pluginExplorerButton = document.getElementById('pluginExplorerButton');
const copyAllButton = document.getElementById('copyAllButton');
const toggleOobPluginsButton = document.getElementById('toggleOobPluginsButton');
const enableLockedFieldsButton = document.getElementById('enableLockedFieldsButton');
const toggleHiddenFieldsButton = document.getElementById('toggleHiddenFieldsButton');
const makeRequiredOptionalButton = document.getElementById('makeRequiredOptionalButton');
const toggleSchemaNamesButton = document.getElementById('toggleSchemaNamesButton');
const exportAllFieldsButton = document.getElementById('exportAllFieldsButton');
const fieldsExportButton = document.getElementById('fieldsExportButton') || exportAllFieldsButton;
const entityExportButton = document.getElementById('entityExportButton');
const searchInput = document.getElementById('searchInput');
const closeButton = document.getElementById('closeButton');
const githubFeedbackButton = document.getElementById('githubFeedbackButton');
const entityInfoButton = document.getElementById('entityInfoButton');
const recordIdButton = document.getElementById('recordIdButton');
const userSecurityRolesButton = document.getElementById('userSecurityRolesButton');
const rolesModal = document.getElementById('rolesModal');
const closeRolesModalButton = document.getElementById('closeRolesModalButton');
const rolesSearchInput = document.getElementById('rolesSearchInput');
const rolesList = document.getElementById('rolesList');
const rolesModalUserSubtitle = document.getElementById('rolesModalUserSubtitle');
const rolesModalCountBadge = document.getElementById('rolesModalCountBadge');
const copyAllRolesButton = document.getElementById('copyAllRolesButton');
const exportRolesButton = document.getElementById('exportRolesButton');

const state = {
  rawResponse: null,
  fields: [],
  selectedEntity: '',
  searchText: '',
  schemaNamesVisible: false,
  fieldsUnlocked: false,
  hiddenFieldsVisible: false,
  mandatoryFieldsDisabled: false,
  currentView: '',
  plugins: [],
  selectedPluginId: '',
  pluginDetailsById: {},
  pluginCatalogLoaded: false,
  loadingPluginId: '',
  showOobPlugins: false,
  entityInfo: null,
  recordDetails: null,
  userRoles: [],
  rolesUserInfo: { userName: '', userId: '' },
  rolesSearchText: ''
};

function applyPopupFrameSizing() {
  const widthValue = `${POPUP_WIDTH}px`;
  document.documentElement.style.width = widthValue;
  document.documentElement.style.minWidth = widthValue;
  document.documentElement.style.maxWidth = widthValue;

  if (document.body) {
    document.body.style.width = widthValue;
    document.body.style.minWidth = widthValue;
    document.body.style.maxWidth = widthValue;
  }
}

refreshButton.addEventListener('click', loadOptionSetValues);
pluginExplorerButton.addEventListener('click', () => loadPluginExplorer());
copyAllButton.addEventListener('click', () => {
  if (state.currentView === 'securityRoles') {
    copyAllRolesToClipboard();
  } else {
    copyAllTables();
  }
});
toggleOobPluginsButton.addEventListener('click', toggleShowOobPlugins);
enableLockedFieldsButton.addEventListener('click', toggleEnableFieldsOnPage);
toggleHiddenFieldsButton.addEventListener('click', toggleHiddenFieldsOnPage);
makeRequiredOptionalButton.addEventListener('click', toggleMandatoryFieldsOnPage);
toggleSchemaNamesButton.addEventListener('click', toggleSchemaNamesOnPage);
if (entityInfoButton) entityInfoButton.addEventListener('click', showEntityInfo);
if (recordIdButton) recordIdButton.addEventListener('click', showRecordId);
if (fieldsExportButton) fieldsExportButton.addEventListener('click', exportFieldsToExcel);
if (entityExportButton) entityExportButton.addEventListener('click', exportEntityMetadataToExcel);
if (userSecurityRolesButton) userSecurityRolesButton.addEventListener('click', showUserSecurityRoles);
if (closeRolesModalButton) closeRolesModalButton.addEventListener('click', closeRolesModal);
if (rolesSearchInput) {
  rolesSearchInput.addEventListener('input', (event) => {
    state.rolesSearchText = String(event.target.value || '').trim().toLowerCase();
    renderRolesList();
  });
}
if (copyAllRolesButton) copyAllRolesButton.addEventListener('click', copyAllRolesToClipboard);
if (exportRolesButton) exportRolesButton.addEventListener('click', exportRolesToExcel);
if (rolesModal) {
  rolesModal.addEventListener('click', (event) => {
    if (event.target === rolesModal) {
      closeRolesModal();
    }
  });
}
resultsElement.addEventListener('click', handleResultsClick);
searchInput.addEventListener('input', (event) => {
  state.searchText = String(event.target.value || '').trim().toLowerCase();
  render();
});
entitySelect.addEventListener('change', (event) => {
  state.selectedEntity = String(event.target.value || '');
  render();
});
closeButton.addEventListener('click', closePopupWithReset);
if (statusElement) {
  statusElement.addEventListener('click', handleStatusClick);
  statusElement.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleStatusClick();
    }
  });
}
if (githubFeedbackButton) {
  githubFeedbackButton.addEventListener('click', (event) => {
    event.preventDefault();
    const feedbackUrl = 'https://github.com/sathishkannan-git/POWER_PILOT/issues/new/choose';
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: feedbackUrl });
    } else {
      window.open(feedbackUrl, '_blank', 'noopener,noreferrer');
    }
  });
}


updateSchemaNamesButton();
updateEnableFieldsButton();
updateHiddenFieldsButton();
updateMandatoryFieldsButton();
updateModeButtons();
updateShowOobPluginsButton();
updateSearchPlaceholder();
updateCopyAllButtonState();
loadEntityOnLaunch();

async function loadEntityOnLaunch() {
  setStatus('Loading entity...');
  entitySelect.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Could not find the active tab.');
    }

    await resetPersistentPageModes(tab.id);

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'MAIN',
      func: getCurrentEntityDetails
    });

    const responses = frameResults.map((frame) => frame.result).filter(Boolean);
    if (responses.length === 0) {
      throw new Error('No response from any frame. Make sure you are on a Dynamics form page.');
    }

    const entityDetails = mergeEntityResponses(responses, tab.url || '');
    state.selectedEntity = entityDetails.entityName || 'Unknown Entity';
    state.schemaNamesVisible = !!entityDetails.schemaNamesVisible;
    state.fieldsUnlocked = !!entityDetails.fieldsUnlocked;
    state.hiddenFieldsVisible = !!entityDetails.hiddenFieldsVisible;
    state.mandatoryFieldsDisabled = !!entityDetails.mandatoryFieldsDisabled;
    hydrateEntitySelect(state.selectedEntity);
    updateSchemaNamesButton();
    updateEnableFieldsButton();
    updateHiddenFieldsButton();
    updateMandatoryFieldsButton();
    updateCopyAllButtonState();

    if (entityDetails.errors.length > 0) {
      renderErrors(entityDetails.errors);
    } else {
      renderErrors([]);
    }

    if (entityDetails.entityName) {
      setStatus(`Entity loaded: ${entityDetails.entityName}. Click OPTION SET or PLUGIN EXPLORER.`);
    } else {
      setStatus('Entity could not be detected. Click OPTION SET or PLUGIN EXPLORER to continue.');
    }
  } catch (error) {
    const message = error?.message || String(error);
    state.schemaNamesVisible = false;
    state.fieldsUnlocked = false;
    state.hiddenFieldsVisible = false;
    state.mandatoryFieldsDisabled = false;
    hydrateEntitySelect('Unknown Entity');
    updateSchemaNamesButton();
    updateEnableFieldsButton();
    updateHiddenFieldsButton();
    updateMandatoryFieldsButton();
    updateCopyAllButtonState();
    renderErrors([]);
    setStatus('Unable to load entity: ' + message);
  } finally {
    entitySelect.disabled = false;
  }
}

function mergeEntityResponses(responses, fallbackUrl) {
  let entityName = '';
  const errors = [];
  let schemaNamesVisible = false;
  let fieldsUnlocked = false;
  let hiddenFieldsVisible = false;
  let mandatoryFieldsDisabled = false;

  responses.forEach((response) => {
    if (!entityName && response?.entityName) {
      entityName = String(response.entityName);
    }

    schemaNamesVisible = schemaNamesVisible || !!response?.schemaNamesVisible;
    fieldsUnlocked = fieldsUnlocked || !!response?.fieldsUnlocked;
    hiddenFieldsVisible = hiddenFieldsVisible || !!response?.hiddenFieldsVisible;
    mandatoryFieldsDisabled = mandatoryFieldsDisabled || !!response?.mandatoryFieldsDisabled;

    if (Array.isArray(response?.errors)) {
      errors.push(...response.errors);
    }
  });

  return {
    url: responses[0]?.url || fallbackUrl,
    entityName,
    schemaNamesVisible,
    fieldsUnlocked,
    hiddenFieldsVisible,
    mandatoryFieldsDisabled,
    errors: dedupeStrings(errors)
  };
}

async function loadOptionSetValues() {
  state.currentView = 'optionSets';
  updateModeButtons();
  updateSearchPlaceholder();
  setStatus('Collecting option set values...');
  errorsElement.innerHTML = '';
  resultsElement.innerHTML = '<div class="empty-state">Loading option set tables...</div>';
  setActionButtonsDisabled(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Could not find the active tab.');
    }

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'MAIN',
      func: collectOptionSetValues
    });

    const responses = frameResults.map((frame) => frame.result).filter(Boolean);
    if (responses.length === 0) {
      throw new Error('No response from any frame. Make sure you are on a Dynamics form page.');
    }

    const merged = mergeResponses(responses, tab.url || '');
    state.rawResponse = merged;
    state.fields = merged.optionSets || [];
    state.selectedEntity = merged.entityName || 'Unknown Entity';
    hydrateEntitySelect(state.selectedEntity);
    updateCopyAllButtonState();

    renderErrors(merged.errors || []);
    render();

    if (state.fields.length > 0) {
      setStatus(`Loaded ${state.fields.length} option set table(s) for ${state.selectedEntity}.`);
    } else {
      setStatus('No option set fields found for this entity.');
    }
  } catch (error) {
    state.fields = [];
    updateCopyAllButtonState();
    setStatus('Unable to collect values: ' + error.message);
    resultsElement.innerHTML = '<div class="error">' + escapeHtml(error.message) + '</div>';
  } finally {
    setActionButtonsDisabled(false);
  }
}

async function exportFieldsToExcel() {
  setStatus('Collecting entity fields for export...');
  errorsElement.innerHTML = '';
  setActionButtonsDisabled(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Could not find the active tab.');
    }

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'MAIN',
      func: collectAllFieldMetadata
    });

    const responses = frameResults.map((frame) => frame.result).filter(Boolean);
    if (responses.length === 0) {
      throw new Error('No response from any frame. Make sure you are on a Dynamics form page.');
    }

    const merged = mergeFieldMetadataResponses(responses);
    renderErrors(merged.errors || []);

    if (!merged.hasXrm) {
      setStatus('Xrm is not available. Open a Dynamics 365 record form and try again.');
      return;
    }

    const entityName = merged.entityName || state.selectedEntity || 'Entity';
    if (merged.fields.length === 0) {
      setStatus('No fields could be found for this entity.');
      return;
    }

    downloadFieldsAsExcel(entityName, merged.fields);
    setStatus(`Exported ${merged.fields.length} field(s) for ${entityName} to Excel.`);
    setTimeout(() => {
      window.close();
    }, 500);
  } catch (error) {
    const message = error?.message || String(error);
    renderErrors([message]);
    setStatus('Unable to export fields: ' + message);
  } finally {
    setActionButtonsDisabled(false);
  }
}

const exportAllFieldsToExcel = exportFieldsToExcel;

async function exportEntityMetadataToExcel() {
  setStatus('Collecting entity metadata for export...');
  errorsElement.innerHTML = '';
  setActionButtonsDisabled(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Could not find the active tab.');
    }

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'MAIN',
      func: collectEntityDefinitionMetadata
    });

    const responses = frameResults.map((frame) => frame.result).filter(Boolean);
    const validResponse = responses.find((res) => res.properties && res.properties.length > 0) || responses.find((res) => res.hasXrm) || responses[0];

    if (!validResponse) {
      throw new Error('No response from any frame. Make sure you are on a Dynamics form page.');
    }

    renderErrors(validResponse.errors || []);

    if (!validResponse.hasXrm) {
      setStatus('Xrm is not available. Open a Dynamics 365 record form and try again.');
      return;
    }

    const entityName = validResponse.entityName || state.selectedEntity || 'Entity';
    const properties = validResponse.properties || [];

    if (properties.length === 0) {
      setStatus('No metadata definition could be found for this entity.');
      return;
    }

    downloadEntityAsExcel(entityName, properties);
    setStatus(`Exported entity metadata definition for ${entityName} to Excel.`);
    setTimeout(() => {
      window.close();
    }, 500);
  } catch (error) {
    const message = error?.message || String(error);
    renderErrors([message]);
    setStatus('Unable to export entity metadata: ' + message);
  } finally {
    setActionButtonsDisabled(false);
  }
}

function downloadFieldsAsExcel(entityName, fields) {
  const rows = fields.map((field) => ({
    'Display Name': field.displayName || '',
    'Schema Name': field.schemaName || '',
    'Data Type': field.dataType || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fields');

  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `${entityName}_Fields_${timestamp}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

function downloadEntityAsExcel(entityName, properties) {
  const worksheet = XLSX.utils.json_to_sheet(properties);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Entity Metadata');

  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `${entityName}_Entity_Metadata_${timestamp}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

function mergeFieldMetadataResponses(responses) {
  const mergedMap = new Map();
  const errors = [];
  let hasXrm = false;
  let entityName = '';

  responses.forEach((response) => {
    hasXrm = hasXrm || !!response.hasXrm;
    if (response.entityName) {
      entityName = response.entityName;
    }

    if (Array.isArray(response.errors)) {
      errors.push(...response.errors);
    }

    (response.fields || []).forEach((field) => {
      if (!field || !field.schemaName) {
        return;
      }

      const key = String(field.schemaName).toLowerCase();
      if (!mergedMap.has(key)) {
        mergedMap.set(key, field);
      }
    });
  });

  return {
    entityName,
    hasXrm,
    fields: Array.from(mergedMap.values()),
    errors: dedupeStrings(errors)
  };
}

function setActionButtonsDisabled(isDisabled) {
  refreshButton.disabled = isDisabled;
  pluginExplorerButton.disabled = isDisabled;
  if (entityInfoButton) entityInfoButton.disabled = isDisabled;
  if (recordIdButton) recordIdButton.disabled = isDisabled;
  enableLockedFieldsButton.disabled = isDisabled;
  toggleHiddenFieldsButton.disabled = isDisabled;
  makeRequiredOptionalButton.disabled = isDisabled;
  toggleSchemaNamesButton.disabled = isDisabled;
  if (fieldsExportButton) fieldsExportButton.disabled = isDisabled;
  if (entityExportButton) entityExportButton.disabled = isDisabled;
  if (userSecurityRolesButton) userSecurityRolesButton.disabled = isDisabled;
  toggleOobPluginsButton.disabled = isDisabled || state.currentView !== 'plugins';
  copyAllButton.disabled = isDisabled || !canUseCopyAll();
}

function updateSchemaNamesButton() {
  const span = toggleSchemaNamesButton.querySelector('span');
  if (span) span.textContent = state.schemaNamesVisible ? 'Hide Schema Names' : 'Show Schema Names';
  toggleSchemaNamesButton.setAttribute('aria-pressed', state.schemaNamesVisible ? 'true' : 'false');
}

function updateEnableFieldsButton() {
  const span = enableLockedFieldsButton.querySelector('span');
  if (span) span.textContent = state.fieldsUnlocked ? 'Restore Field Locks' : 'Enable Fields';
  enableLockedFieldsButton.setAttribute('aria-pressed', state.fieldsUnlocked ? 'true' : 'false');
}

function updateHiddenFieldsButton() {
  const span = toggleHiddenFieldsButton.querySelector('span');
  if (span) span.textContent = state.hiddenFieldsVisible ? 'Restore Hidden Fields' : 'Show Hidden Fields';
  toggleHiddenFieldsButton.setAttribute('aria-pressed', state.hiddenFieldsVisible ? 'true' : 'false');
}

function updateMandatoryFieldsButton() {
  const span = makeRequiredOptionalButton.querySelector('span');
  if (span) span.textContent = state.mandatoryFieldsDisabled ? 'Restore Mandatory' : 'Disable Mandatory';
  makeRequiredOptionalButton.setAttribute('aria-pressed', state.mandatoryFieldsDisabled ? 'true' : 'false');
}

function updateModeButtons() {
  refreshButton.setAttribute('aria-pressed', state.currentView === 'optionSets' ? 'true' : 'false');
  pluginExplorerButton.setAttribute('aria-pressed', state.currentView === 'plugins' ? 'true' : 'false');
  if (entityInfoButton) entityInfoButton.setAttribute('aria-pressed', state.currentView === 'entityInfo' ? 'true' : 'false');
  if (recordIdButton) recordIdButton.setAttribute('aria-pressed', state.currentView === 'recordId' ? 'true' : 'false');
  if (userSecurityRolesButton) userSecurityRolesButton.setAttribute('aria-pressed', state.currentView === 'securityRoles' ? 'true' : 'false');
}

function updateShowOobPluginsButton() {
  const span = toggleOobPluginsButton.querySelector('span');
  if (span) span.innerHTML = (state.showOobPlugins ? 'Hide OOB Plugins' : 'Show OOB Plugins') + ' <span class="badge-new">new</span>';
  toggleOobPluginsButton.setAttribute('aria-pressed', state.showOobPlugins ? 'true' : 'false');
}

function updateSearchPlaceholder() {
  let placeholder = 'Search by name or columns';
  if (state.currentView === 'plugins') {
    placeholder = 'Search by plugin, assembly, step, entity, or message';
  } else if (state.currentView === 'entityInfo') {
    placeholder = 'Search entity details or schema name...';
  } else if (state.currentView === 'recordId') {
    placeholder = 'Search record ID or details...';
  } else if (state.currentView === 'securityRoles') {
    placeholder = 'Search security roles or GUIDs...';
  }
  searchInput.placeholder = placeholder;
  searchInput.setAttribute('aria-label', placeholder);
}

function updateCopyAllButtonState() {
  const canCopyAll = canUseCopyAll();
  const isCopyableView = state.currentView === 'optionSets' || state.currentView === 'securityRoles';
  copyAllButton.hidden = !isCopyableView || !canCopyAll;
  copyAllButton.disabled = !isCopyableView || !canCopyAll;

  const isPluginView = state.currentView === 'plugins';
  toggleOobPluginsButton.hidden = !isPluginView;
  toggleOobPluginsButton.disabled = !isPluginView;
}

function canUseCopyAll() {
  if (state.currentView === 'securityRoles') {
    return Array.isArray(state.userRoles) && state.userRoles.length > 0;
  }
  return state.currentView === 'optionSets' && Array.isArray(state.fields) && state.fields.length > 0;
}

function toggleShowOobPlugins() {
  state.showOobPlugins = !state.showOobPlugins;
  updateShowOobPluginsButton();
  state.selectedPluginId = '';
  loadPluginExplorer(state.selectedPluginId);
}

async function toggleEnableFieldsOnPage() {
  const shouldEnable = !state.fieldsUnlocked;
  const response = await runFormAction({
    pendingMessage: shouldEnable
      ? 'Enabling locked fields on the form...'
      : 'Restoring original field lock states...',
    actionFunction: toggleFieldsOnForm,
    actionArgs: [shouldEnable],
    successMessageBuilder: (count) => (shouldEnable
      ? `Enabled ${count} locked field(s).`
      : `Restored ${count} field(s) to their original lock state.`),
    noChangesMessage: shouldEnable
      ? 'No locked fields were found on this form.'
      : 'No fields needed to be restored.'
  });

  if (!response) {
    return;
  }

  state.fieldsUnlocked = shouldEnable ? response.changedCount > 0 : false;
  updateEnableFieldsButton();
  updateCopyAllButtonState();

  if (response.changedCount > 0) {
    setStatus(shouldEnable
      ? `Enabled ${response.changedCount} locked field(s).`
      : `Restored ${response.changedCount} field(s) to their original lock state.`);
  } else {
    setStatus(shouldEnable ? 'No locked fields were found on this form.' : 'No fields needed to be restored.');
  }
}

async function toggleMandatoryFieldsOnPage() {
  const shouldDisable = !state.mandatoryFieldsDisabled;
  const response = await runFormAction({
    pendingMessage: shouldDisable
      ? 'Converting business required fields to optional...'
      : 'Restoring business required fields...',
    actionFunction: toggleBusinessRequiredFieldsOnForm,
    actionArgs: [shouldDisable],
    successMessageBuilder: (count) => (shouldDisable
      ? `Updated ${count} business required field(s) to optional.`
      : `Restored ${count} field(s) to business required.`),
    noChangesMessage: shouldDisable
      ? 'No business required fields were found on this form.'
      : 'No fields needed to be restored.'
  });

  if (!response) {
    return;
  }

  state.mandatoryFieldsDisabled = shouldDisable ? response.changedCount > 0 : false;
  updateMandatoryFieldsButton();
  updateCopyAllButtonState();

  if (response.changedCount > 0) {
    setStatus(shouldDisable
      ? `Updated ${response.changedCount} business required field(s) to optional.`
      : `Restored ${response.changedCount} field(s) to business required.`);
  } else {
    setStatus(shouldDisable ? 'No business required fields were found on this form.' : 'No fields needed to be restored.');
  }
}

async function toggleHiddenFieldsOnPage() {
  const shouldEnable = !state.hiddenFieldsVisible;
  setStatus(shouldEnable ? 'Showing hidden fields on the form...' : 'Restoring hidden fields on the form...');
  errorsElement.innerHTML = '';
  setActionButtonsDisabled(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Could not find the active tab.');
    }

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'MAIN',
      func: toggleHiddenFieldsOnForm,
      args: [shouldEnable]
    });

    const responses = frameResults.map((frame) => frame.result).filter(Boolean);
    if (responses.length === 0) {
      throw new Error('No response from any frame. Make sure you are on a Dynamics form page.');
    }

    const merged = mergeHiddenFieldToggleResponses(responses);
    if (!merged.hasXrm) {
      throw new Error('Xrm is not available. Open a Dynamics 365 record form and try again.');
    }

    state.hiddenFieldsVisible = !!merged.hiddenFieldsVisible;
    updateHiddenFieldsButton();

    if (merged.errors.length > 0) {
      renderErrors(merged.errors);
    }

    if (merged.hiddenFieldsVisible) {
      setStatus(
        merged.changedCount > 0
          ? `Revealed ${merged.changedCount} hidden field(s). Hidden-field badges are now shown on the form.`
          : 'No hidden fields were found on this form.'
      );
    } else {
      setStatus(
        merged.changedCount > 0
          ? `Restored ${merged.changedCount} hidden field(s) to their original visibility.`
          : 'Hidden fields are restored to their original state.'
      );
    }
  } catch (error) {
    const message = error?.message || String(error);
    renderErrors([message]);
    setStatus('Unable to toggle hidden fields: ' + message);
  } finally {
    setActionButtonsDisabled(false);
  }
}

async function toggleSchemaNamesOnPage() {
  const shouldEnable = !state.schemaNamesVisible;
  setStatus(shouldEnable ? 'Showing schema names on the form...' : 'Hiding schema names on the form...');
  errorsElement.innerHTML = '';
  setActionButtonsDisabled(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Could not find the active tab.');
    }

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'MAIN',
      func: toggleSchemaNamesOnForm,
      args: [shouldEnable]
    });

    const responses = frameResults.map((frame) => frame.result).filter(Boolean);
    if (responses.length === 0) {
      throw new Error('No response from any frame. Make sure you are on a Dynamics form page.');
    }

    const merged = mergeSchemaToggleResponses(responses);
    if (!merged.hasXrm) {
      throw new Error('Xrm is not available. Open a Dynamics 365 record form and try again.');
    }

    state.schemaNamesVisible = merged.schemaNamesVisible;
    updateSchemaNamesButton();

    if (merged.errors.length > 0) {
      renderErrors(merged.errors);
    } else {
      renderErrors([]);
    }

    if (merged.schemaNamesVisible) {
      setStatus(
        merged.changedCount > 0
          ? `Showing schema names for ${merged.changedCount} field(s).`
          : 'Schema names are enabled for the current tab.'
      );
    } else {
      setStatus(
        merged.changedCount > 0
          ? `Hid schema names for ${merged.changedCount} field(s).`
          : 'Schema names are hidden.'
      );
    }
  } catch (error) {
    const message = error?.message || String(error);
    renderErrors([message]);
    setStatus('Unable to toggle schema names: ' + message);
  } finally {
    setActionButtonsDisabled(false);
  }
}

async function closePopupWithReset() {
  errorsElement.innerHTML = '';

  if (!state.schemaNamesVisible && !state.fieldsUnlocked && !state.hiddenFieldsVisible && !state.mandatoryFieldsDisabled) {
    window.close();
    return;
  }

  setStatus('Resetting enabled buttons before closing...');
  setActionButtonsDisabled(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Could not find the active tab.');
    }

    const merged = await resetPersistentPageModes(tab.id);

    state.schemaNamesVisible = false;
    state.fieldsUnlocked = false;
    state.hiddenFieldsVisible = false;
    state.mandatoryFieldsDisabled = false;
    updateSchemaNamesButton();
    updateEnableFieldsButton();
    updateHiddenFieldsButton();
    updateMandatoryFieldsButton();
    updateCopyAllButtonState();
    renderErrors(merged.errors || []);
    window.close();
  } catch (error) {
    const message = error?.message || String(error);
    renderErrors([message]);
    setStatus('Unable to reset enabled buttons: ' + message);
  } finally {
    setActionButtonsDisabled(false);
  }
}

async function resetPersistentPageModes(tabId) {
  const schemaFrameResults = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: 'MAIN',
    func: toggleSchemaNamesOnForm,
    args: [false]
  });

  const schemaResponses = schemaFrameResults.map((frame) => frame.result).filter(Boolean);
  if (schemaResponses.length === 0) {
    throw new Error('No response from any frame. Make sure you are on a Dynamics form page.');
  }

  const mergedSchema = mergeSchemaToggleResponses(schemaResponses);
  if (!mergedSchema.hasXrm) {
    throw new Error('Xrm is not available. Open a Dynamics 365 record form and try again.');
  }

  const fieldsFrameResults = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: 'MAIN',
    func: toggleFieldsOnForm,
    args: [false]
  });

  const fieldsResponses = fieldsFrameResults.map((frame) => frame.result).filter(Boolean);
  if (fieldsResponses.length === 0) {
    throw new Error('No response from any frame. Make sure you are on a Dynamics form page.');
  }

  const mergedFields = mergeActionResponses(fieldsResponses);
  if (!mergedFields.hasXrm) {
    throw new Error('Xrm is not available. Open a Dynamics 365 record form and try again.');
  }

  const hiddenFrameResults = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: 'MAIN',
    func: toggleHiddenFieldsOnForm,
    args: [false]
  });

  const hiddenResponses = hiddenFrameResults.map((frame) => frame.result).filter(Boolean);
  if (hiddenResponses.length === 0) {
    throw new Error('No response from any frame. Make sure you are on a Dynamics form page.');
  }

  const mergedHidden = mergeHiddenFieldToggleResponses(hiddenResponses);
  if (!mergedHidden.hasXrm) {
    throw new Error('Xrm is not available. Open a Dynamics 365 record form and try again.');
  }

  const mandatoryFrameResults = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: 'MAIN',
    func: toggleBusinessRequiredFieldsOnForm,
    args: [false]
  });

  const mandatoryResponses = mandatoryFrameResults.map((frame) => frame.result).filter(Boolean);
  if (mandatoryResponses.length === 0) {
    throw new Error('No response from any frame. Make sure you are on a Dynamics form page.');
  }

  const mergedMandatory = mergeActionResponses(mandatoryResponses);
  if (!mergedMandatory.hasXrm) {
    throw new Error('Xrm is not available. Open a Dynamics 365 record form and try again.');
  }

  return {
    errors: dedupeStrings([...(mergedSchema.errors || []), ...(mergedFields.errors || []), ...(mergedHidden.errors || []), ...(mergedMandatory.errors || [])])
  };
}

async function runFormAction({ pendingMessage, actionFunction, actionArgs = [], successMessageBuilder, noChangesMessage }) {
  setStatus(pendingMessage);
  errorsElement.innerHTML = '';
  setActionButtonsDisabled(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Could not find the active tab.');
    }

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'MAIN',
      func: actionFunction,
      args: actionArgs
    });

    const responses = frameResults.map((frame) => frame.result).filter(Boolean);
    if (responses.length === 0) {
      throw new Error('No response from any frame. Make sure you are on a Dynamics form page.');
    }

    const merged = mergeActionResponses(responses);
    if (!merged.hasXrm) {
      throw new Error('Xrm is not available. Open a Dynamics 365 record form and try again.');
    }

    if (merged.errors.length > 0) {
      renderErrors(merged.errors);
    }

    if (merged.changedCount > 0) {
      setStatus(successMessageBuilder(merged.changedCount));
    } else {
      setStatus(noChangesMessage);
    }

    return merged;
  } catch (error) {
    const message = error?.message || String(error);
    renderErrors([message]);
    setStatus('Unable to update form fields: ' + message);
    return null;
  } finally {
    setActionButtonsDisabled(false);
  }
}

function mergeActionResponses(responses) {
  const changedFieldNames = new Set();
  const errors = [];
  let hasXrm = false;

  responses.forEach((response) => {
    hasXrm = hasXrm || !!response.hasXrm;
    (response.changedFieldNames || []).forEach((fieldName) => {
      if (fieldName) {
        changedFieldNames.add(String(fieldName));
      }
    });

    if (Array.isArray(response.errors)) {
      errors.push(...response.errors);
    }
  });

  return {
    hasXrm,
    changedCount: changedFieldNames.size,
    changedFieldNames: Array.from(changedFieldNames),
    errors: dedupeStrings(errors)
  };
}

function mergeHiddenFieldToggleResponses(responses) {
  const changedFieldNames = new Set();
  const errors = [];
  let hasXrm = false;
  let hiddenFieldsVisible = false;

  responses.forEach((response) => {
    hasXrm = hasXrm || !!response.hasXrm;
    hiddenFieldsVisible = hiddenFieldsVisible || !!response.hiddenFieldsVisible;

    (response.changedFieldNames || []).forEach((fieldName) => {
      if (fieldName) {
        changedFieldNames.add(String(fieldName));
      }
    });

    if (Array.isArray(response.errors)) {
      errors.push(...response.errors);
    }
  });

  return {
    hasXrm,
    hiddenFieldsVisible,
    changedCount: changedFieldNames.size,
    changedFieldNames: Array.from(changedFieldNames),
    errors: dedupeStrings(errors)
  };
}

function mergeSchemaToggleResponses(responses) {
  const changedFieldNames = new Set();
  const errors = [];
  let hasXrm = false;
  let schemaNamesVisible = false;

  responses.forEach((response) => {
    hasXrm = hasXrm || !!response.hasXrm;
    schemaNamesVisible = schemaNamesVisible || !!response.schemaNamesVisible;

    (response.changedFieldNames || []).forEach((fieldName) => {
      if (fieldName) {
        changedFieldNames.add(String(fieldName));
      }
    });

    if (Array.isArray(response.errors)) {
      errors.push(...response.errors);
    }
  });

  return {
    hasXrm,
    schemaNamesVisible,
    changedCount: changedFieldNames.size,
    changedFieldNames: Array.from(changedFieldNames),
    errors: dedupeStrings(errors)
  };
}

function hydrateEntitySelect(entityName) {
  const safeEntity = entityName || 'Unknown Entity';
  entitySelect.innerHTML = `<option value="${escapeHtml(safeEntity)}">${escapeHtml(safeEntity)}</option>`;
  entitySelect.value = safeEntity;
}

function render() {
  if (state.currentView === 'plugins') {
    renderPluginExplorer();
    return;
  }
  if (state.currentView === 'entityInfo') {
    renderEntityInfoView();
    return;
  }
  if (state.currentView === 'recordId') {
    renderRecordIdView();
    return;
  }
  if (state.currentView === 'securityRoles') {
    renderSecurityRolesView();
    return;
  }

  renderOptionSetView();
}

function renderOptionSetView() {
  const fields = getFilteredFields();

  if (fields.length === 0) {
    const emptyMessage = state.fields.length === 0 && !state.searchText
      ? 'No option set tables were found for this entity.'
      : 'No tables match your search.';
    resultsElement.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  resultsElement.innerHTML = fields.map((field) => renderFieldCard(field)).join('');
}

function getFilteredFields() {
  const query = state.searchText;
  if (!query) {
    return state.fields;
  }

  return state.fields.filter((field) => {
    const cols = getColumnConfig(field).map((col) => col.key).join(' ');
    const optionBlob = (field.options || [])
      .map((option) => [option.text, option.value, option.state, option.defaultStatus].join(' '))
      .join(' ')
      .toLowerCase();

    return [field.label, field.name, cols, optionBlob]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

function getFilteredPlugins() {
  const query = state.searchText;
  if (!query) {
    return state.plugins;
  }

  return state.plugins.filter((plugin) => {
    const detail = state.pluginDetailsById[plugin.id];
    const solutionsBlob = (detail?.solutions || [])
      .map((solution) => [solution.scope, solution.friendlyName, solution.uniqueName, solution.version].join(' '))
      .join(' ');
    const stepsBlob = (detail?.steps || [])
      .map((step) => [
        step.name,
        step.messageName,
        step.primaryEntityName,
        step.stageLabel,
        step.modeLabel,
        step.filteringAttributes,
        step.rank,
        step.statusLabel
      ].join(' '))
      .join(' ');

    return [
      plugin.displayName,
      plugin.typeName,
      plugin.assemblyName,
      plugin.assemblyFullName,
      plugin.assemblyVersion,
      plugin.isolationModeLabel,
      plugin.createdBy,
      plugin.modifiedBy,
      solutionsBlob,
      stepsBlob
    ]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

function renderPluginExplorer() {
  if (!state.pluginCatalogLoaded) {
    resultsElement.innerHTML = '<div class="empty-state">No plug-ins loaded yet. Click PLUGIN EXPLORER.</div>';
    return;
  }

  const plugins = getFilteredPlugins();
  if (plugins.length === 0) {
    resultsElement.innerHTML = `<div class="empty-state">${state.searchText ? 'No plug-ins match your search.' : 'No registered plug-ins were found.'}</div>`;
    return;
  }

  const selectedPlugin = plugins.find((plugin) => plugin.id === state.selectedPluginId) || plugins[0];
  const pluginDetail = selectedPlugin ? state.pluginDetailsById[selectedPlugin.id] : null;
  const listHtml = plugins.map((plugin) => renderPluginListItem(plugin, plugin.id === selectedPlugin?.id)).join('');

  resultsElement.innerHTML = `
    <div class="inspector-layout">
      <section class="section-card">
        <div class="section-heading-row">
          <h2 class="section-title">Registered Plug-ins</h2>
          <span class="section-badge">${plugins.length}</span>
        </div>
        <div class="plugin-list">${listHtml}</div>
      </section>
      <section class="section-card">
        <div class="section-heading-row">
          <h2 class="section-title">Inspector</h2>
          <span class="section-badge">${selectedPlugin ? 'Ready' : 'None'}</span>
        </div>
        ${renderPluginDetail(selectedPlugin, pluginDetail)}
      </section>
    </div>
  `;
}

function renderPluginListItem(plugin, isActive) {
  const activeClass = isActive ? ' active' : '';
  const assemblyLabel = plugin.assemblyName || 'Unknown assembly';
  const versionLabel = plugin.assemblyVersion && plugin.assemblyVersion !== '-'
    ? `v${plugin.assemblyVersion}`
    : 'Version unavailable';

  return `
    <button type="button" class="plugin-list-item${activeClass}" data-select-plugin="${escapeHtml(plugin.id)}">
      <h3 class="plugin-list-title">${escapeHtml(plugin.displayName || plugin.typeName || 'Unnamed plug-in')}</h3>
      <p class="plugin-list-meta">${escapeHtml(plugin.typeName || '-')}</p>
      <p class="plugin-list-meta">${escapeHtml(assemblyLabel)} • ${escapeHtml(versionLabel)} • ${escapeHtml(plugin.isolationModeLabel || 'Unknown')}</p>
    </button>
  `;
}

function renderPluginDetail(plugin, detail) {
  if (!plugin) {
    return '<div class="plugin-detail"><div class="empty-state">Select a plug-in to inspect its metadata and registered steps.</div></div>';
  }

  if (state.loadingPluginId === plugin.id && !detail) {
    return '<div class="plugin-detail"><div class="empty-state">Loading plug-in details...</div></div>';
  }

  if (!detail) {
    return '<div class="plugin-detail"><div class="empty-state">Select a plug-in to load its metadata and step details.</div></div>';
  }

  const solutionsHtml = detail.solutions.length > 0
    ? detail.solutions.map((solution) => `
      <div class="solution-item">
        <strong>${escapeHtml(solution.friendlyName || solution.uniqueName || 'Unnamed solution')}</strong>
        <span>${escapeHtml(solution.scope)} • ${escapeHtml(solution.uniqueName || '-')} • ${escapeHtml(solution.version || '-')}</span>
        <span>${escapeHtml(solution.isManagedLabel)}</span>
      </div>
    `).join('')
    : '<div class="empty-state">No solution context was returned for this plug-in type or its assembly.</div>';

  const stepsHtml = detail.steps.length > 0
    ? detail.steps.map((step) => renderPluginStep(step)).join('')
    : '<div class="empty-state">No processing steps are registered for this plug-in type.</div>';

  return `
    <div class="plugin-detail">
      <div class="plugin-detail-header">
        <div class="plugin-detail-heading">
          <h3 class="plugin-detail-title">${escapeHtml(detail.displayName)}</h3>
          <p class="plugin-detail-subtitle">${escapeHtml(detail.typeName)}${detail.description ? ` — ${escapeHtml(detail.description)}` : ''}</p>
        </div>
        <div class="plugin-detail-actions">
          <button type="button" class="copy-btn" data-copy-plugin-details="${escapeHtml(detail.id)}">COPY DETAILS</button>
        </div>
      </div>
      <div class="detail-grid">
        ${renderDetailRow('Plugin Name', detail.displayName)}
        ${renderDetailRow('Type Name', detail.typeName)}
        ${renderDetailRow('Assembly Name', detail.assemblyName)}
        ${renderDetailRow('Assembly Full Name', detail.assemblyFullName)}
        ${renderDetailRow('Assembly Version', detail.assemblyVersion)}
        ${renderDetailRow('Isolation Mode', detail.isolationModeLabel)}
        ${renderDetailRow('Created On', formatDateValue(detail.createdOn))}
        ${renderDetailRow('Created By', detail.createdBy)}
        ${renderDetailRow('Modified On', formatDateValue(detail.modifiedOn))}
        ${renderDetailRow('Last Modified By', detail.modifiedBy)}
      </div>
      <h4 class="subsection-title">Solution Context</h4>
      <div class="solution-list">${solutionsHtml}</div>
      <h4 class="subsection-title">Processing Steps</h4>
      <div class="step-list">${stepsHtml}</div>
    </div>
  `;
}

function renderPluginStep(step) {
  const imagesHtml = step.images.length > 0
    ? `
      <h5 class="subsection-title">Step Images</h5>
      <div class="image-list">
        ${step.images.map((image) => `
          <div class="image-item">
            <strong>${escapeHtml(image.name || image.entityAlias || 'Unnamed image')}</strong>
            <span>${escapeHtml(image.imageTypeLabel)} • Alias: ${escapeHtml(image.entityAlias || '-')}</span>
            <span>Attributes: ${escapeHtml(image.attributes || '-')}</span>
            <span>Message Property: ${escapeHtml(image.messagePropertyName || '-')}</span>
          </div>
        `).join('')}
      </div>
    `
    : '';

  return `
    <article class="step-card">
      <h4 class="step-title">${escapeHtml(step.name)}</h4>
      <div class="tag-row">
        <span class="tag">${escapeHtml(step.messageName)}</span>
        <span class="tag">${escapeHtml(step.primaryEntityName)}</span>
        <span class="tag">${escapeHtml(step.stageLabel)}</span>
        <span class="tag">${escapeHtml(step.modeLabel)}</span>
        <span class="tag">${escapeHtml(step.statusLabel)}</span>
        <span class="tag">Rank ${escapeHtml(String(step.rank))}</span>
      </div>
      <div class="step-meta-grid" style="margin-top: 10px;">
        ${renderDetailRow('Primary Entity', step.primaryEntityName)}
        ${renderDetailRow('SDK Message', step.messageName)}
        ${renderDetailRow('Stage', step.stageLabel)}
        ${renderDetailRow('Execution Mode', step.modeLabel)}
        ${renderDetailRow('Filtering Attributes', step.filteringAttributes || '-')}
        ${renderDetailRow('Execution Order / Rank', String(step.rank))}
        ${renderDetailRow('Step Status', step.statusLabel)}
        ${renderDetailRow('Created On', formatDateValue(step.createdOn))}
        ${renderDetailRow('Created By', step.createdBy)}
        ${renderDetailRow('Modified On', formatDateValue(step.modifiedOn))}
        ${renderDetailRow('Last Modified By', step.modifiedBy)}
      </div>
      ${imagesHtml}
    </article>
  `;
}

function renderDetailRow(label, value) {
  return `
    <div class="detail-row">
      <div class="detail-label">${escapeHtml(label)}</div>
      <div class="detail-value">${escapeHtml(value || '-')}</div>
    </div>
  `;
}

function formatDateValue(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString();
}

function renderFieldCard(field) {
  const columns = getColumnConfig(field);
  const headerHtml = columns
    .map((col) => `<th class="${escapeHtml(col.className)}">${escapeHtml(col.title)}</th>`)
    .join('');

  const rowsHtml = (field.options || [])
    .map((option) => {
      const cells = columns
        .map((col, index) => {
          const rawValue = formatCellValue(option, col.key);
          const value = shouldEnableCellCopy(col.key)
            ? renderCopyableText(rawValue, `Copied ${col.title} ${rawValue}.`, 'copyable-text copyable-value')
            : escapeHtml(rawValue);
          if (index === 0 && option.isSelected) {
            return `<td class="${escapeHtml(col.className)}">${value} <span class="current-pill">Current</span></td>`;
          }
          return `<td class="${escapeHtml(col.className)}">${value}</td>`;
        })
        .join('');

      const rowClass = option.isSelected ? ' class="current-row"' : '';
      return `<tr${rowClass}>${cells}</tr>`;
    })
    .join('');

  const currentSummary = buildCurrentSummary(field);

  return `
    <section class="table-card">
      <div class="table-header">
        <h2 class="table-title">${escapeHtml(field.label || field.name)}</h2>
        <button class="copy-btn" data-copy-field="${escapeHtml(field.name)}">COPY</button>
      </div>
      <div class="columns-info">Columns involved: ${renderCopyableText(field.name, `Copied schema name ${field.name}.`, 'copyable-text copyable-schema')} ${currentSummary}</div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function buildCurrentSummary(field) {
  const selectedOptions = (field.options || []).filter((option) => option.isSelected);
  if (selectedOptions.length === 0) {
    return '';
  }

  const labels = selectedOptions.map((option) => option.text).join(', ');
  return ` <span class="current-pill">Current: ${escapeHtml(labels)}</span>`;
}

function shouldEnableCellCopy(key) {
  return key === 'value';
}

function renderCopyableText(text, successMessage, className) {
  return `<button type="button" class="${escapeHtml(className)}" data-copy-text="${escapeHtml(text)}" data-copy-message="${escapeHtml(successMessage)}">${escapeHtml(text)}</button>`;
}

function getColumnConfig(field) {
  const logicalName = String(field.name || '').toLowerCase();
  const type = String(field.type || '').toLowerCase();

  if (logicalName === 'statecode' || type === 'state') {
    return [
      { key: 'text', title: 'Name', className: 'name-col' },
      { key: 'defaultStatus', title: 'DefaultStatus', className: 'mid-col' },
      { key: 'value', title: 'Value', className: 'value-col' }
    ];
  }

  if (logicalName === 'statuscode' || type === 'status') {
    return [
      { key: 'text', title: 'Name', className: 'name-col' },
      { key: 'state', title: 'State', className: 'mid-col' },
      { key: 'value', title: 'Value', className: 'value-col' }
    ];
  }

  return [
    { key: 'text', title: 'Name', className: 'name-col' },
    { key: 'value', title: 'Value', className: 'value-col' }
  ];
}

function formatCellValue(option, key) {
  const value = option?.[key];
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return String(value);
}

function renderErrors(errors) {
  if (!errors || errors.length === 0) {
    errorsElement.innerHTML = '';
    return;
  }

  errorsElement.innerHTML = `<div class="error">${errors.map((error) => escapeHtml(error)).join('<br/>')}</div>`;
}

function mergeResponses(responses, fallbackUrl) {
  const mergedMap = new Map();
  const errors = [];
  let hasXrm = false;
  let entityName = 'Unknown Entity';

  responses.forEach((response) => {
    hasXrm = hasXrm || !!response.hasXrm;
    if (response.entityName) {
      entityName = response.entityName;
    }

    if (Array.isArray(response.errors)) {
      errors.push(...response.errors);
    }

    (response.optionSets || []).forEach((incomingField) => {
      if (!incomingField || !incomingField.name) {
        return;
      }

      const key = String(incomingField.name).toLowerCase();
      const existing = mergedMap.get(key);

      if (!existing) {
        mergedMap.set(key, normalizeField(incomingField));
        return;
      }

      mergedMap.set(key, mergeField(existing, normalizeField(incomingField)));
    });
  });

  return {
    url: responses[0]?.url || fallbackUrl,
    entityName,
    hasXrm,
    optionSets: Array.from(mergedMap.values()),
    errors: dedupeStrings(mergedMap.size > 0 ? errors.filter((error) => !isNoResultsError(error)) : errors)
  };
}

function isNoResultsError(error) {
  return String(error || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '') === 'no option set fields found for this entity or form';
}

function normalizeField(field) {
  return {
    name: field.name,
    label: field.label || field.name,
    type: field.type || 'picklist',
    source: field.source || 'Unknown',
    options: dedupeOptions(field.options || []),
    currentValue: field.currentValue
  };
}

function mergeField(a, b) {
  const optionMap = new Map();

  [...(a.options || []), ...(b.options || [])].forEach((option) => {
    const key = String(option.value);
    const previous = optionMap.get(key);

    if (!previous) {
      optionMap.set(key, { ...option });
      return;
    }

    optionMap.set(key, {
      ...previous,
      ...option,
      text: option.text || previous.text,
      isSelected: !!(previous.isSelected || option.isSelected),
      state: option.state !== undefined ? option.state : previous.state,
      defaultStatus: option.defaultStatus !== undefined ? option.defaultStatus : previous.defaultStatus
    });
  });

  return {
    ...a,
    ...b,
    label: a.label || b.label,
    source: [a.source, b.source].filter(Boolean).join('+'),
    options: Array.from(optionMap.values()).sort((x, y) => Number(x.value) - Number(y.value)),
    currentValue: b.currentValue !== undefined ? b.currentValue : a.currentValue
  };
}

function dedupeOptions(options) {
  const map = new Map();
  (options || []).forEach((option) => {
    const key = String(option.value);
    if (!map.has(key)) {
      map.set(key, {
        value: option.value,
        text: option.text,
        isSelected: !!option.isSelected,
        state: option.state,
        defaultStatus: option.defaultStatus
      });
      return;
    }

    const existing = map.get(key);
    map.set(key, {
      ...existing,
      ...option,
      text: option.text || existing.text,
      isSelected: !!(existing.isSelected || option.isSelected),
      state: option.state !== undefined ? option.state : existing.state,
      defaultStatus: option.defaultStatus !== undefined ? option.defaultStatus : existing.defaultStatus
    });
  });

  return Array.from(map.values()).sort((x, y) => Number(x.value) - Number(y.value));
}

function dedupeStrings(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

async function loadPluginExplorer(preferredPluginId) {
  state.currentView = 'plugins';
  updateModeButtons();
  updateShowOobPluginsButton();
  updateSearchPlaceholder();
  updateCopyAllButtonState();
  setStatus(state.showOobPlugins ? 'Loading registered plug-ins...' : 'Loading registered custom plug-ins...');
  renderErrors([]);
  resultsElement.innerHTML = '<div class="empty-state">Loading plug-in catalog...</div>';
  setActionButtonsDisabled(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Could not find the active tab.');
    }

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'MAIN',
      func: queryPluginInspectorData,
      args: ['catalog', null, state.showOobPlugins]
    });

    const responses = frameResults.map((frame) => frame.result).filter(Boolean);
    if (responses.length === 0) {
      throw new Error('No response from any frame. Open a Dynamics 365 page and try again.');
    }

    const merged = mergePluginCatalogResponses(responses, tab.url || '');
    if (!merged.hasXrm) {
      throw new Error('Xrm is not available. Open a Dynamics 365 or Power Apps page and try again.');
    }

    state.plugins = merged.plugins;
    state.pluginCatalogLoaded = true;
    renderErrors(merged.errors || []);

    if (state.plugins.length === 0) {
      state.selectedPluginId = '';
      render();
      setStatus(state.showOobPlugins ? 'No registered plug-ins were found.' : 'No registered custom plug-ins were found.');
      return;
    }

    const preferredId = preferredPluginId || state.selectedPluginId;
    const defaultPluginId = state.plugins.some((plugin) => plugin.id === preferredId)
      ? preferredId
      : state.plugins[0].id;
    await selectPlugin(defaultPluginId, { tabId: tab.id });
    setStatus(`Loaded ${state.plugins.length} plug-in type(s).`);
  } catch (error) {
    const message = error?.message || String(error);
    state.plugins = [];
    state.selectedPluginId = '';
    state.pluginCatalogLoaded = true;
    renderErrors([message]);
    resultsElement.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
    setStatus('Unable to load plug-ins: ' + message);
  } finally {
    setActionButtonsDisabled(false);
  }
}

async function selectPlugin(pluginId, options = {}) {
  if (!pluginId) {
    return;
  }

  state.currentView = 'plugins';
  state.selectedPluginId = pluginId;
  updateModeButtons();
  updateSearchPlaceholder();
  updateCopyAllButtonState();
  render();

  if (state.pluginDetailsById[pluginId]) {
    render();
    return;
  }

  state.loadingPluginId = pluginId;
  render();

  try {
    const tabId = options.tabId || await getActiveTabId();
    const frameResults = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: 'MAIN',
      func: queryPluginInspectorData,
      args: ['details', pluginId]
    });

    const responses = frameResults.map((frame) => frame.result).filter(Boolean);
    if (responses.length === 0) {
      throw new Error('No response from any frame. Open a Dynamics 365 page and try again.');
    }

    const merged = mergePluginDetailResponses(responses);
    if (!merged.hasXrm) {
      throw new Error('Xrm is not available. Open a Dynamics 365 or Power Apps page and try again.');
    }

    if (merged.detail) {
      state.pluginDetailsById[pluginId] = merged.detail;
      upsertPluginCatalogItem(merged.detail);
    }

    renderErrors(merged.errors || []);
    render();
  } catch (error) {
    const message = error?.message || String(error);
    renderErrors([message]);
    setStatus('Unable to load plug-in details: ' + message);
    render();
  } finally {
    state.loadingPluginId = '';
  }
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error('Could not find the active tab.');
  }
  return tab.id;
}

function mergePluginCatalogResponses(responses, fallbackUrl) {
  const pluginMap = new Map();
  const errors = [];
  let hasXrm = false;

  responses.forEach((response) => {
    hasXrm = hasXrm || !!response.hasXrm;

    if (Array.isArray(response.errors)) {
      errors.push(...response.errors);
    }

    (response.plugins || []).forEach((plugin) => {
      if (!plugin || !plugin.id) {
        return;
      }

      const key = String(plugin.id).toLowerCase();
      const normalized = normalizePluginCatalogItem(plugin);
      pluginMap.set(key, mergePluginCatalogItem(pluginMap.get(key), normalized));
    });
  });

  return {
    url: responses[0]?.url || fallbackUrl,
    hasXrm,
    plugins: Array.from(pluginMap.values()).sort((left, right) => {
      return String(left.displayName || left.typeName || '').localeCompare(String(right.displayName || right.typeName || ''));
    }),
    errors: dedupeStrings(pluginMap.size > 0 ? errors.filter((error) => !isNoPluginResultsError(error)) : errors)
  };
}

function mergePluginDetailResponses(responses) {
  const errors = [];
  let hasXrm = false;
  let detail = null;

  responses.forEach((response) => {
    hasXrm = hasXrm || !!response.hasXrm;

    if (Array.isArray(response.errors)) {
      errors.push(...response.errors);
    }

    if (!detail && response.detail) {
      detail = normalizePluginDetail(response.detail);
    }
  });

  return {
    hasXrm,
    detail,
    errors: dedupeStrings(errors)
  };
}

function normalizePluginCatalogItem(plugin) {
  const displayName = resolvePluginDisplayName(plugin);

  return {
    id: plugin.id,
    displayName,
    name: plugin.name || plugin.displayName || plugin.typeName || 'Unnamed plug-in',
    typeName: plugin.typeName || plugin.typename || plugin.displayName || plugin.name || '',
    assemblyName: plugin.assemblyName || '',
    assemblyFullName: plugin.assemblyFullName || plugin.assemblyName || '',
    assemblyVersion: plugin.assemblyVersion || '',
    isolationModeLabel: plugin.isolationModeLabel || '',
    createdOn: plugin.createdOn || '',
    createdBy: plugin.createdBy || '',
    modifiedOn: plugin.modifiedOn || '',
    modifiedBy: plugin.modifiedBy || ''
  };
}

function mergePluginCatalogItem(existing, incoming) {
  if (!existing) {
    return { ...incoming };
  }

  function preferValue(currentValue, incomingValue) {
    return currentValue && currentValue !== '-' ? currentValue : incomingValue;
  }

  return {
    ...existing,
    ...incoming,
    displayName: preferValue(existing.displayName, incoming.displayName),
    typeName: preferValue(existing.typeName, incoming.typeName),
    assemblyName: preferValue(existing.assemblyName, incoming.assemblyName),
    assemblyFullName: preferValue(existing.assemblyFullName, incoming.assemblyFullName),
    assemblyVersion: preferValue(existing.assemblyVersion, incoming.assemblyVersion),
    isolationModeLabel: preferValue(existing.isolationModeLabel, incoming.isolationModeLabel),
    createdBy: preferValue(existing.createdBy, incoming.createdBy),
    modifiedBy: preferValue(existing.modifiedBy, incoming.modifiedBy)
  };
}

function normalizePluginDetail(detail) {
  const displayName = resolvePluginDisplayName(detail);

  return {
    id: detail.id,
    displayName,
    name: detail.name || detail.displayName || detail.typeName || 'Unnamed plug-in',
    typeName: detail.typeName || detail.typename || '',
    description: detail.description || '',
    assemblyName: detail.assemblyName || '',
    assemblyFullName: detail.assemblyFullName || detail.assemblyName || '',
    assemblyVersion: detail.assemblyVersion || '',
    isolationModeLabel: detail.isolationModeLabel || '',
    createdOn: detail.createdOn || '',
    createdBy: detail.createdBy || '',
    modifiedOn: detail.modifiedOn || '',
    modifiedBy: detail.modifiedBy || '',
    solutions: Array.isArray(detail.solutions) ? detail.solutions : [],
    steps: Array.isArray(detail.steps) ? detail.steps : []
  };
}

function upsertPluginCatalogItem(detail) {
  const normalized = normalizePluginCatalogItem(detail);
  const existingIndex = state.plugins.findIndex((plugin) => plugin.id === normalized.id);
  if (existingIndex === -1) {
    state.plugins.push(normalized);
    state.plugins.sort((left, right) => String(left.displayName || '').localeCompare(String(right.displayName || '')));
    return;
  }

  state.plugins.splice(existingIndex, 1, mergePluginCatalogItem(state.plugins[existingIndex], normalized));
}

function isNoPluginResultsError(error) {
  const normalized = String(error || '').trim().toLowerCase().replace(/\.$/, '');
  return normalized === 'no registered custom plug-in types were found' ||
    normalized === 'no registered plug-in types were found';
}

function isGuidLike(value) {
  const normalized = String(value || '').trim();
  return /^[{(]?[0-9a-fA-F]{8}[-]?[0-9a-fA-F]{4}[-]?[0-9a-fA-F]{4}[-]?[0-9a-fA-F]{4}[-]?[0-9a-fA-F]{12}[)}]?$/.test(normalized);
}

function getShortTypeName(typeName) {
  const normalized = String(typeName || '').trim();
  if (!normalized) {
    return '';
  }

  const parts = normalized.split('.');
  return parts[parts.length - 1] || normalized;
}

function resolvePluginDisplayName(record) {
  const explicitDisplayName = String(record && record.displayName ? record.displayName : '').trim();
  if (explicitDisplayName && !isGuidLike(explicitDisplayName)) {
    return explicitDisplayName;
  }

  const friendlyName = String(record && record.friendlyName ? record.friendlyName : '').trim();
  if (friendlyName && !isGuidLike(friendlyName)) {
    return friendlyName;
  }

  const shortTypeName = getShortTypeName(record && (record.typeName || record.typename));
  if (shortTypeName && !isGuidLike(shortTypeName)) {
    return shortTypeName;
  }

  const rawName = String(record && record.name ? record.name : '').trim();
  if (rawName && !isGuidLike(rawName)) {
    return rawName;
  }

  const fullTypeName = String(record && (record.typeName || record.typename) ? (record.typeName || record.typename) : '').trim();
  if (fullTypeName) {
    return fullTypeName;
  }

  return 'Unnamed plug-in';
}

async function copyFieldTable(field) {
  const text = tableToTsv(field);
  await writeClipboard(text, `Copied ${field.label || field.name}.`);
}

async function copyAllTables() {
  const fields = getFilteredFields();
  if (fields.length === 0) {
    setStatus('Nothing to copy.');
    return;
  }

  const text = fields.map((field) => tableToTsv(field)).join('\n\n');
  await writeClipboard(text, `Copied ${fields.length} table(s).`);
}

function handleResultsClick(event) {
  const pluginButton = event.target.closest('[data-select-plugin]');
  if (pluginButton) {
    const pluginId = pluginButton.getAttribute('data-select-plugin');
    if (pluginId) {
      selectPlugin(pluginId);
    }
    return;
  }

  const copyPluginDetailsButton = event.target.closest('[data-copy-plugin-details]');
  if (copyPluginDetailsButton) {
    const pluginId = copyPluginDetailsButton.getAttribute('data-copy-plugin-details');
    if (!pluginId) {
      return;
    }

    const detail = state.pluginDetailsById[pluginId];
    if (!detail) {
      setStatus('Plug-in details are still loading. Try again in a moment.');
      return;
    }

    writeClipboard(pluginDetailToText(detail), `Copied plug-in details for ${detail.displayName}.`);
    return;
  }

  const copyFieldButton = event.target.closest('[data-copy-field]');
  if (copyFieldButton) {
    const fieldName = copyFieldButton.getAttribute('data-copy-field');
    if (!fieldName) {
      return;
    }

    const field = state.fields.find((item) => item.name === fieldName);
    if (!field) {
      return;
    }

    copyFieldTable(field);
    return;
  }

  const copyTextButton = event.target.closest('[data-copy-text]');
  if (!copyTextButton) {
    return;
  }

  const text = copyTextButton.getAttribute('data-copy-text');
  if (!text) {
    return;
  }

  const successMessage = copyTextButton.getAttribute('data-copy-message') || `Copied ${text}.`;
  writeClipboard(text, successMessage);
}

function tableToTsv(field) {
  const columns = getColumnConfig(field);
  const header = columns.map((col) => col.title).join('\t');
  const body = (field.options || []).map((option) => {
    return columns.map((col) => formatCellValue(option, col.key)).join('\t');
  });

  return [
    `${field.label || field.name} (${field.name})`,
    header,
    ...body
  ].join('\n');
}

function pluginDetailToText(detail) {
  const lines = [
    `Plugin Name:\t${detail.displayName || '-'}`,
    `Type Name:\t${detail.typeName || '-'}`,
    `Assembly Name:\t${detail.assemblyName || '-'}`,
    `Assembly Full Name:\t${detail.assemblyFullName || '-'}`,
    `Assembly Version:\t${detail.assemblyVersion || '-'}`,
    `Isolation Mode:\t${detail.isolationModeLabel || '-'}`,
    `Created On:\t${formatDateValue(detail.createdOn)}`,
    `Created By:\t${detail.createdBy || '-'}`,
    `Modified On:\t${formatDateValue(detail.modifiedOn)}`,
    `Last Modified By:\t${detail.modifiedBy || '-'}`
  ];

  lines.push('');
  lines.push('Solution Context');
  if (!detail.solutions || detail.solutions.length === 0) {
    lines.push('  - None');
  } else {
    detail.solutions.forEach((solution) => {
      lines.push(`  - ${solution.scope || '-'} | ${solution.friendlyName || solution.uniqueName || '-'} | ${solution.uniqueName || '-'} | ${solution.version || '-'} | ${solution.isManagedLabel || '-'}`);
    });
  }

  lines.push('');
  lines.push('Processing Steps');
  if (!detail.steps || detail.steps.length === 0) {
    lines.push('  - None');
  } else {
    detail.steps.forEach((step, index) => {
      lines.push(`  ${index + 1}. ${step.name || '-'}`);
      lines.push(`     Entity:\t${step.primaryEntityName || '-'}`);
      lines.push(`     Message:\t${step.messageName || '-'}`);
      lines.push(`     Stage:\t${step.stageLabel || '-'}`);
      lines.push(`     Mode:\t${step.modeLabel || '-'}`);
      lines.push(`     Filtering Attributes:\t${step.filteringAttributes || '-'}`);
      lines.push(`     Rank:\t${step.rank}`);
      lines.push(`     Status:\t${step.statusLabel || '-'}`);
      if (step.images && step.images.length > 0) {
        lines.push('     Images:');
        step.images.forEach((image) => {
          lines.push(`       - ${image.name || image.entityAlias || '-'} | ${image.imageTypeLabel || '-'} | Alias: ${image.entityAlias || '-'} | Attributes: ${image.attributes || '-'} | Message Property: ${image.messagePropertyName || '-'}`);
        });
      }
    });
  }

  return lines.join('\n');
}

async function writeClipboard(text, successMessage = '') {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
    if (successMessage) {
      setStatus(successMessage);
    }
  } catch (error) {
    fallbackCopy(text);
    if (successMessage) {
      setStatus(successMessage);
    }
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function setStatus(message, copyValue = '') {
  if (!statusElement) return;
  const statusText = document.getElementById('statusText');

  if (statusText) {
    statusText.innerHTML = message;
  } else {
    statusElement.innerHTML = message;
  }

  if (copyValue) {
    statusElement.dataset.copyValue = copyValue;
    statusElement.title = `Click to copy: ${copyValue}`;
  } else {
    const raw = (statusText ? statusText.textContent : statusElement.textContent || '').trim();
    statusElement.dataset.copyValue = raw;
    statusElement.title = 'Click to copy';
  }
}

async function handleStatusClick() {
  if (!statusElement) return;
  const valueToCopy = (statusElement.dataset.copyValue || (document.getElementById('statusText')?.textContent) || statusElement.textContent || '').trim();
  if (!valueToCopy) return;

  await writeClipboard(valueToCopy);
  flashStatusCopied();
}

function flashStatusCopied() {
  const copyIcon = document.getElementById('statusCopyIcon');
  if (!copyIcon) return;
  const originalHtml = copyIcon.innerHTML;
  copyIcon.innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700; color: #16a34a; background: #eafaf1; padding: 2px 6px; border-radius: 6px; border: 1px solid #bbf7d0;">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      Copied!
    </span>
  `;
  statusElement.classList.add('status-copied-flash');
  setTimeout(() => {
    try {
      copyIcon.innerHTML = originalHtml;
      statusElement.classList.remove('status-copied-flash');
    } catch (_) {}
  }, 1800);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function queryPluginInspectorData(action, pluginTypeId, includeOobPlugins) {
  try {
    function getXrmRoot() {
      const candidates = [window, window.top, window.parent].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (candidate && candidate.Xrm) {
            return candidate.Xrm;
          }
        } catch (e) {
          // Ignore cross-origin exceptions
        }
      }
      return null;
    }

    function normalizeGuid(value) {
      return String(value || '').replace(/[{}]/g, '').toLowerCase();
    }

    function getApiVersionCandidates(xrmRoot) {
      const candidates = [];
      const globalContext = xrmRoot && xrmRoot.Utility && typeof xrmRoot.Utility.getGlobalContext === 'function'
        ? xrmRoot.Utility.getGlobalContext()
        : null;
      const rawVersion = globalContext && typeof globalContext.getVersion === 'function'
        ? globalContext.getVersion()
        : null;
      const normalizedVersion = rawVersion
        ? `v${String(rawVersion).split('.').slice(0, 2).join('.')}`
        : null;

      if (normalizedVersion) {
        candidates.push(normalizedVersion);
      }

      ['v9.2', 'v9.1', 'v9.0', 'v8.2', 'v8.1'].forEach((version) => {
        if (!candidates.includes(version)) {
          candidates.push(version);
        }
      });

      return candidates;
    }

    function getClientUrl(xrmRoot) {
      const globalContext = xrmRoot && xrmRoot.Utility && typeof xrmRoot.Utility.getGlobalContext === 'function'
        ? xrmRoot.Utility.getGlobalContext()
        : null;
      if (!globalContext || typeof globalContext.getClientUrl !== 'function') {
        throw new Error('Xrm global context is unavailable.');
      }
      return globalContext.getClientUrl();
    }

    function buildHeaders() {
      return {
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        Prefer: 'odata.include-annotations="*"'
      };
    }

    async function fetchJsonWithVersionFallback(path, xrmRoot) {
      const clientUrl = getClientUrl(xrmRoot);
      const versions = getApiVersionCandidates(xrmRoot);
      let lastErrorMessage = null;

      for (const version of versions) {
        const url = `${clientUrl}/api/data/${version}/${path}`;
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(),
            credentials: 'include'
          });

          if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            throw new Error(responseText || `${response.status} ${response.statusText}`);
          }

          return await response.json();
        } catch (error) {
          lastErrorMessage = error && error.message ? error.message : String(error);
        }
      }

      throw new Error(lastErrorMessage || 'No supported Dataverse Web API version was available.');
    }

    async function fetchAllPages(path, xrmRoot) {
      const payload = await fetchJsonWithVersionFallback(path, xrmRoot);
      const items = Array.isArray(payload && payload.value) ? payload.value.slice() : [];
      let nextLink = payload && payload['@odata.nextLink'] ? payload['@odata.nextLink'] : null;

      while (nextLink) {
        const response = await fetch(nextLink, {
          method: 'GET',
          headers: buildHeaders(),
          credentials: 'include'
        });

        if (!response.ok) {
          const responseText = await response.text().catch(() => '');
          throw new Error(responseText || `${response.status} ${response.statusText}`);
        }

        const nextPayload = await response.json();
        items.push(...(Array.isArray(nextPayload && nextPayload.value) ? nextPayload.value : []));
        nextLink = nextPayload && nextPayload['@odata.nextLink'] ? nextPayload['@odata.nextLink'] : null;
      }

      return items;
    }

    function mapIsolationMode(value) {
      if (value === 1) {
        return 'None';
      }
      if (value === 2) {
        return 'Sandbox';
      }
      return value === null || value === undefined ? '-' : String(value);
    }

    function mapStage(value) {
      const stageMap = {
        5: 'Initial Pre-operation (5)',
        10: 'Pre-validation (10)',
        15: 'Internal Pre-operation Before External Plugins (15)',
        20: 'Pre-operation (20)',
        25: 'Internal Pre-operation After External Plugins (25)',
        35: 'Internal Post-operation Before External Plugins (35)',
        40: 'Post-operation (40)',
        45: 'Internal Post-operation After External Plugins (45)',
        50: 'Post-operation (Deprecated) (50)',
        55: 'Final Post-operation (55)'
      };
      return stageMap[value] || (value === null || value === undefined ? '-' : `Stage ${value}`);
    }

    function mapMode(value) {
      if (value === 0) {
        return 'Synchronous (0)';
      }
      if (value === 1) {
        return 'Asynchronous (1)';
      }
      return value === null || value === undefined ? '-' : String(value);
    }

    function mapStepStatus(stateCode, statusCode) {
      if (stateCode === 0 || statusCode === 1) {
        return 'Enabled';
      }
      if (stateCode === 1 || statusCode === 2) {
        return 'Disabled';
      }
      return stateCode === null || stateCode === undefined ? '-' : `State ${stateCode}`;
    }

    function mapImageType(value) {
      if (value === 0) {
        return 'PreImage';
      }
      if (value === 1) {
        return 'PostImage';
      }
      if (value === 2) {
        return 'Both';
      }
      return value === null || value === undefined ? '-' : String(value);
    }

    function mapManagedLabel(value) {
      return value ? 'Managed' : 'Unmanaged';
    }

    function parseAssemblyNames(assemblyRecord) {
      const rawName = assemblyRecord && assemblyRecord.name ? String(assemblyRecord.name) : '';
      if (!rawName) {
        return { assemblyName: '', assemblyFullName: '' };
      }

      const shortName = rawName.includes(',')
        ? rawName.split(',')[0].trim()
        : rawName.trim();

      return {
        assemblyName: shortName,
        assemblyFullName: rawName.trim()
      };
    }

    function isGuidLikeValue(value) {
      const normalized = String(value || '').trim();
      return /^[{(]?[0-9a-fA-F]{8}[-]?[0-9a-fA-F]{4}[-]?[0-9a-fA-F]{4}[-]?[0-9a-fA-F]{4}[-]?[0-9a-fA-F]{12}[)}]?$/.test(normalized);
    }

    function getShortTypeName(typeName) {
      const normalized = String(typeName || '').trim();
      if (!normalized) {
        return '';
      }

      const parts = normalized.split('.');
      return parts[parts.length - 1] || normalized;
    }

    function resolvePluginDisplayName(record) {
      const friendlyName = String(record && record.friendlyname ? record.friendlyname : '').trim();
      if (friendlyName && !isGuidLikeValue(friendlyName)) {
        return friendlyName;
      }

      const shortTypeName = getShortTypeName(record && record.typename);
      if (shortTypeName && !isGuidLikeValue(shortTypeName)) {
        return shortTypeName;
      }

      const plainName = String(record && record.name ? record.name : '').trim();
      if (plainName && !isGuidLikeValue(plainName)) {
        return plainName;
      }

      const typeName = String(record && record.typename ? record.typename : '').trim();
      if (typeName) {
        return typeName;
      }

      return 'Unnamed plug-in';
    }

    function isOutOfBoxPluginRecord(record) {
      const typeName = String(record && record.typename ? record.typename : '').trim().toLowerCase();
      const assemblyName = String(
        record && record.pluginassemblyid && record.pluginassemblyid.name
          ? record.pluginassemblyid.name
          : ''
      ).trim().toLowerCase();

      return typeName.startsWith('microsoft.') || assemblyName.startsWith('microsoft.');
    }

    function normalizePluginCatalogRecord(record) {
      const assembly = record && record.pluginassemblyid ? record.pluginassemblyid : {};
      const assemblyNames = parseAssemblyNames(assembly);
      return {
        id: normalizeGuid(record && record.plugintypeid),
        name: record && record.name ? record.name : '',
        displayName: resolvePluginDisplayName(record),
        typeName: record && record.typename ? record.typename : '',
        assemblyName: assemblyNames.assemblyName,
        assemblyFullName: assemblyNames.assemblyFullName,
        assemblyVersion: assembly && assembly.version ? assembly.version : '',
        isolationModeLabel: mapIsolationMode(assembly && assembly.isolationmode),
        createdOn: record && record.createdon ? record.createdon : '',
        createdBy: record && record.createdby && record.createdby.fullname ? record.createdby.fullname : '',
        modifiedOn: record && record.modifiedon ? record.modifiedon : '',
        modifiedBy: record && record.modifiedby && record.modifiedby.fullname ? record.modifiedby.fullname : ''
      };
    }

    function normalizePluginDetailRecord(record, solutions) {
      const assembly = record && record.pluginassemblyid ? record.pluginassemblyid : {};
      const assemblyNames = parseAssemblyNames(assembly);
      const steps = Array.isArray(record && record.plugintype_sdkmessageprocessingstep)
        ? record.plugintype_sdkmessageprocessingstep.map((step) => {
          const filter = step && step.sdkmessagefilterid ? step.sdkmessagefilterid : {};
          const images = Array.isArray(step && step.sdkmessageprocessingstepid_sdkmessageprocessingstepimage)
            ? step.sdkmessageprocessingstepid_sdkmessageprocessingstepimage.map((image) => ({
              id: normalizeGuid(image && image.sdkmessageprocessingstepimageid),
              name: image && image.name ? image.name : '',
              entityAlias: image && image.entityalias ? image.entityalias : '',
              imageType: image && typeof image.imagetype === 'number' ? image.imagetype : null,
              imageTypeLabel: mapImageType(image && image.imagetype),
              attributes: image && image.attributes ? image.attributes : '',
              messagePropertyName: image && image.messagepropertyname ? image.messagepropertyname : '',
              relatedAttributeName: image && image.relatedattributename ? image.relatedattributename : ''
            }))
            : [];

          return {
            id: normalizeGuid(step && step.sdkmessageprocessingstepid),
            name: step && step.name ? step.name : `${step && step.sdkmessageid && step.sdkmessageid.name ? step.sdkmessageid.name : 'Unknown Message'} step`,
            primaryEntityName: filter && filter.primaryobjecttypecode ? filter.primaryobjecttypecode : 'Global',
            secondaryEntityName: filter && filter.secondaryobjecttypecode ? filter.secondaryobjecttypecode : '',
            messageName: step && step.sdkmessageid && step.sdkmessageid.name ? step.sdkmessageid.name : '-',
            stage: step && typeof step.stage === 'number' ? step.stage : null,
            stageLabel: mapStage(step && step.stage),
            mode: step && typeof step.mode === 'number' ? step.mode : null,
            modeLabel: mapMode(step && step.mode),
            rank: step && typeof step.rank === 'number' ? step.rank : 0,
            filteringAttributes: step && step.filteringattributes ? step.filteringattributes : '',
            stateCode: step && typeof step.statecode === 'number' ? step.statecode : null,
            statusCode: step && typeof step.statuscode === 'number' ? step.statuscode : null,
            statusLabel: mapStepStatus(step && step.statecode, step && step.statuscode),
            createdOn: step && step.createdon ? step.createdon : '',
            createdBy: step && step.createdby && step.createdby.fullname ? step.createdby.fullname : '',
            modifiedOn: step && step.modifiedon ? step.modifiedon : '',
            modifiedBy: step && step.modifiedby && step.modifiedby.fullname ? step.modifiedby.fullname : '',
            images
          };
        }).sort((left, right) => {
          if (left.rank !== right.rank) {
            return left.rank - right.rank;
          }
          return String(left.name || '').localeCompare(String(right.name || ''));
        })
        : [];

      return {
        id: normalizeGuid(record && record.plugintypeid),
        name: record && record.name ? record.name : '',
        displayName: resolvePluginDisplayName(record),
        typeName: record && record.typename ? record.typename : '',
        description: record && record.description ? record.description : '',
        assemblyName: assemblyNames.assemblyName,
        assemblyFullName: assemblyNames.assemblyFullName,
        assemblyVersion: assembly && assembly.version ? assembly.version : '',
        isolationModeLabel: mapIsolationMode(assembly && assembly.isolationmode),
        createdOn: record && record.createdon ? record.createdon : '',
        createdBy: record && record.createdby && record.createdby.fullname ? record.createdby.fullname : '',
        modifiedOn: record && record.modifiedon ? record.modifiedon : '',
        modifiedBy: record && record.modifiedby && record.modifiedby.fullname ? record.modifiedby.fullname : '',
        solutions,
        steps
      };
    }

    async function fetchSolutionContext(plugintypeId, pluginassemblyId, xrmRoot) {
      const filters = [];
      if (plugintypeId) {
        filters.push(`(componenttype eq 90 and objectid eq ${normalizeGuid(plugintypeId)})`);
      }
      if (pluginassemblyId) {
        filters.push(`(componenttype eq 91 and objectid eq ${normalizeGuid(pluginassemblyId)})`);
      }

      if (filters.length === 0) {
        return [];
      }

      const path = `solutioncomponents?$select=solutioncomponentid,componenttype,objectid&$filter=${encodeURIComponent(filters.join(' or '))}&$expand=solutionid($select=solutionid,friendlyname,uniquename,version,ismanaged)`;
      const records = await fetchAllPages(path, xrmRoot);
      const seen = new Set();

      return records.map((record) => {
        const solution = record && record.solutionid ? record.solutionid : {};
        const scope = record && record.componenttype === 90 ? 'Plug-in Type' : 'Assembly';
        const key = `${scope}::${normalizeGuid(solution && solution.solutionid)}`;
        if (seen.has(key)) {
          return null;
        }
        seen.add(key);
        return {
          id: normalizeGuid(solution && solution.solutionid),
          friendlyName: solution && solution.friendlyname ? solution.friendlyname : '',
          uniqueName: solution && solution.uniquename ? solution.uniquename : '',
          version: solution && solution.version ? solution.version : '',
          isManaged: !!(solution && solution.ismanaged),
          isManagedLabel: mapManagedLabel(!!(solution && solution.ismanaged)),
          scope
        };
      }).filter(Boolean).sort((left, right) => {
        if (left.scope !== right.scope) {
          return left.scope.localeCompare(right.scope);
        }
        return String(left.friendlyName || left.uniqueName || '').localeCompare(String(right.friendlyName || right.uniqueName || ''));
      });
    }

    async function loadCatalog(xrmRoot, shouldIncludeOobPlugins) {
      const path = 'plugintypes?$select=plugintypeid,name,friendlyname,typename,description,createdon,modifiedon&$expand='
        + 'pluginassemblyid($select=pluginassemblyid,name,version,isolationmode),'
        + 'createdby($select=fullname),'
        + 'modifiedby($select=fullname)'
        + '&$filter=customizationlevel eq 1&$orderby=name asc';
      const records = await fetchAllPages(path, xrmRoot);
      const filteredRecords = shouldIncludeOobPlugins
        ? records
        : records.filter((record) => !isOutOfBoxPluginRecord(record));
      return filteredRecords
        .map(normalizePluginCatalogRecord)
        .filter((plugin) => plugin.id)
        .sort((left, right) => String(left.displayName || '').localeCompare(String(right.displayName || '')));
    }

    async function loadDetail(xrmRoot, selectedPluginTypeId) {
      const normalizedId = normalizeGuid(selectedPluginTypeId);
      if (!normalizedId) {
        throw new Error('A plug-in type id is required.');
      }

      const path = `plugintypes(${normalizedId})?$select=plugintypeid,name,friendlyname,typename,description,createdon,modifiedon`
        + '&$expand='
        + 'pluginassemblyid($select=pluginassemblyid,name,version,isolationmode),'
        + 'createdby($select=fullname),'
        + 'modifiedby($select=fullname),'
        + 'plugintype_sdkmessageprocessingstep('
        + '$select=sdkmessageprocessingstepid,name,stage,mode,rank,filteringattributes,statecode,statuscode,createdon,modifiedon;'
        + '$expand='
        + 'sdkmessageid($select=name),'
        + 'sdkmessagefilterid($select=name,primaryobjecttypecode,secondaryobjecttypecode),'
        + 'createdby($select=fullname),'
        + 'modifiedby($select=fullname),'
        + 'sdkmessageprocessingstepid_sdkmessageprocessingstepimage($select=sdkmessageprocessingstepimageid,name,entityalias,imagetype,attributes,messagepropertyname,relatedattributename)'
        + ')';

      const record = await fetchJsonWithVersionFallback(path, xrmRoot);
      const assemblyId = record && record.pluginassemblyid && record.pluginassemblyid.pluginassemblyid
        ? record.pluginassemblyid.pluginassemblyid
        : null;
      const solutions = await fetchSolutionContext(normalizedId, assemblyId, xrmRoot);
      return normalizePluginDetailRecord(record, solutions);
    }

    const xrm = getXrmRoot();
    if (!xrm) {
      return {
        url: location.href,
        hasXrm: false,
        plugins: [],
        detail: null,
        errors: []
      };
    }

    if (action === 'catalog') {
      const plugins = await loadCatalog(xrm, !!includeOobPlugins);
      return {
        url: location.href,
        hasXrm: true,
        plugins,
        errors: plugins.length > 0
          ? []
          : [includeOobPlugins ? 'No registered plug-in types were found.' : 'No registered custom plug-in types were found.']
      };
    }

    if (action === 'details') {
      const detail = await loadDetail(xrm, pluginTypeId);
      return {
        url: location.href,
        hasXrm: true,
        detail,
        errors: []
      };
    }

    throw new Error(`Unsupported plug-in inspector action: ${action}`);
  } catch (error) {
    return {
      url: location.href,
      hasXrm: !!(window && (window.Xrm || (window.top && window.top.Xrm) || (window.parent && window.parent.Xrm))),
      plugins: [],
      detail: null,
      errors: ['Failed to load plug-in inspector data: ' + (error && error.message ? error.message : String(error))]
    };
  }
}

function toggleHiddenFieldsOnForm(shouldEnable) {
  try {
    const hiddenFieldStateKey = '__powerPilotHiddenFieldState__';
    const hiddenFieldNotificationId = 'powerPilotHiddenFieldReveal';
    const hiddenFieldMarkerClass = 'power-pilot-hidden-field-revealed';
    const hiddenFieldStyleId = 'power-pilot-hidden-field-style';

    function getXrmRoot() {
      const candidates = [window, window.top, window.parent].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (candidate && candidate.Xrm) {
            return candidate.Xrm;
          }
        } catch (e) {
          // Ignore cross-origin exceptions
        }
      }
      return null;
    }

    function getActiveFormContext(xrmRoot) {
      if (xrmRoot && xrmRoot.Page && xrmRoot.Page.ui && xrmRoot.Page.ui.controls) {
        return xrmRoot.Page;
      }

      return null;
    }

    function getItems(collection) {
      if (!collection || typeof collection.get !== 'function') {
        return [];
      }

      return collection.get() || [];
    }

    function ensureMarkerStyle(doc) {
      if (!doc || !doc.head || doc.getElementById(hiddenFieldStyleId)) {
        return;
      }

      const style = doc.createElement('style');
      style.id = hiddenFieldStyleId;
      style.textContent = `
        .${hiddenFieldMarkerClass} {
          outline: 1px dashed #f59e0b !important;
          outline-offset: 2px !important;
          border-radius: 4px !important;
        }
      `;
      doc.head.appendChild(style);
    }

    function escapeAttributeValue(value) {
      return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function findControlContainers(controlName) {
      if (!controlName || !document.querySelectorAll) {
        return [];
      }

      ensureMarkerStyle(document);
      const escapedName = escapeAttributeValue(controlName);
      const selectors = [
        `[data-id="${escapedName}.fieldControl"]`,
        `[data-id="${escapedName}.fieldControl-container"]`,
        `[data-id="${escapedName}-FieldSectionItemContainer"]`,
        `[data-id*="${escapedName}.fieldControl"]`,
        `[data-id*="${escapedName}-FieldSectionItemContainer"]`
      ];
      const seen = new Set();
      const containers = [];

      selectors.forEach((selector) => {
        const nodes = Array.from(document.querySelectorAll(selector));
        nodes.forEach((node) => {
          const container = node.closest('[data-id$="FieldSectionItemContainer"]') ||
            node.closest('[data-id$=".fieldControl-container"]') ||
            node;
          if (!seen.has(container)) {
            seen.add(container);
            containers.push(container);
          }
        });
      });

      return containers;
    }

    function markControlContainer(controlName) {
      findControlContainers(controlName).forEach((node) => {
        node.classList.add(hiddenFieldMarkerClass);
      });
    }

    function unmarkControlContainer(controlName) {
      findControlContainers(controlName).forEach((node) => {
        node.classList.remove(hiddenFieldMarkerClass);
      });
    }

    function clearAllMarkers() {
      Array.from(document.querySelectorAll(`.${hiddenFieldMarkerClass}`)).forEach((node) => {
        node.classList.remove(hiddenFieldMarkerClass);
      });
    }

    function getItemName(item) {
      return typeof item?.getName === 'function' ? item.getName() : '';
    }

    function buildControlLocator(control, index) {
      return {
        index,
        name: getItemName(control)
      };
    }

    function buildTabLocator(tab, index) {
      return {
        index,
        name: getItemName(tab)
      };
    }

    function buildSectionLocator(section, tabIndex, sectionIndex) {
      return {
        tabIndex,
        sectionIndex,
        name: getItemName(section)
      };
    }

    function dedupeLocators(locators, keySelector) {
      const seen = new Set();
      return (locators || []).filter((locator) => {
        const key = keySelector(locator);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    function findControlByLocator(controls, locator) {
      if (locator && Number.isInteger(locator.index) && controls[locator.index]) {
        return controls[locator.index];
      }

      if (locator && locator.name) {
        const matches = controls.filter((control) => getItemName(control) === locator.name);
        if (matches.length === 1) {
          return matches[0];
        }
      }

      return null;
    }

    function findTabByLocator(tabs, locator) {
      if (locator && Number.isInteger(locator.index) && tabs[locator.index]) {
        return tabs[locator.index];
      }

      if (locator && locator.name) {
        const matches = tabs.filter((tab) => getItemName(tab) === locator.name);
        if (matches.length === 1) {
          return matches[0];
        }
      }

      return null;
    }

    function findSectionByLocator(tabs, locator) {
      if (locator && Number.isInteger(locator.tabIndex)) {
        const tab = tabs[locator.tabIndex];
        if (tab) {
          const sections = getItems(tab.sections);
          if (Number.isInteger(locator.sectionIndex) && sections[locator.sectionIndex]) {
            return sections[locator.sectionIndex];
          }
        }
      }

      if (locator && locator.name) {
        const matches = [];
        tabs.forEach((tab) => {
          getItems(tab?.sections).forEach((section) => {
            if (getItemName(section) === locator.name) {
              matches.push(section);
            }
          });
        });

        if (matches.length === 1) {
          return matches[0];
        }
      }

      return null;
    }

    const xrm = getXrmRoot();
    const formContext = getActiveFormContext(xrm);
    if (!formContext) {
      return {
        hasXrm: false,
        hiddenFieldsVisible: false,
        changedFieldNames: [],
        errors: []
      };
    }

    const controls = getItems(formContext?.ui?.controls);
    const tabs = getItems(formContext?.ui?.tabs);
    const sectionLookup = new WeakMap();
    const tabLookup = new WeakMap();

    tabs.forEach((tab, tabIndex) => {
      if (tab && typeof tab === 'object') {
        tabLookup.set(tab, tabIndex);
      }

      getItems(tab?.sections).forEach((section, sectionIndex) => {
        if (section && typeof section === 'object') {
          sectionLookup.set(section, { tabIndex, sectionIndex });
        }
      });
    });

    const existingState = window[hiddenFieldStateKey] || {
      enabled: false,
      revealedControls: [],
      revealedSections: [],
      revealedTabs: []
    };
    const changedFieldNames = new Set();
    const revealedControls = [];
    const revealedSections = [];
    const revealedTabs = [];
    const errors = [];

    if (shouldEnable) {
      controls.forEach((control, index) => {
        if (typeof control?.getVisible !== 'function' || typeof control?.setVisible !== 'function') {
          return;
        }

        const controlName = getItemName(control);
        const controlLabel = controlName || `Control at index ${index}`;
        if (control.getVisible()) {
          return;
        }

        const section = typeof control.getParent === 'function' ? control.getParent() : null;
        const sectionLocator = sectionLookup.get(section);
        const tab = section && typeof section.getParent === 'function' ? section.getParent() : null;
        const tabIndex = tabLookup.get(tab);

        try {
          if (tab && typeof tab.getVisible === 'function' && typeof tab.setVisible === 'function' && !tab.getVisible()) {
            tab.setVisible(true);
            revealedTabs.push(buildTabLocator(tab, Number.isInteger(tabIndex) ? tabIndex : null));
          }

          if (section && typeof section.getVisible === 'function' && typeof section.setVisible === 'function' && !section.getVisible()) {
            section.setVisible(true);
            revealedSections.push(buildSectionLocator(
              section,
              sectionLocator && Number.isInteger(sectionLocator.tabIndex) ? sectionLocator.tabIndex : (Number.isInteger(tabIndex) ? tabIndex : null),
              sectionLocator && Number.isInteger(sectionLocator.sectionIndex) ? sectionLocator.sectionIndex : null
            ));
          }

          control.setVisible(true);
          revealedControls.push(buildControlLocator(control, index));
          changedFieldNames.add(controlLabel);
        } catch (error) {
          errors.push(`Failed to reveal ${controlLabel}: ${error?.message || String(error)}`);
          return;
        }

        if (typeof control.setNotification === 'function') {
          try {
            control.setNotification('Power Pilot: this field was originally hidden on the form.', hiddenFieldNotificationId);
          } catch (error) {
            errors.push(`Revealed ${controlLabel}, but failed to add the hidden-field badge: ${error?.message || String(error)}`);
          }
        }

        if (controlName) {
          try {
            markControlContainer(controlName);
          } catch (error) {
            errors.push(`Revealed ${controlLabel}, but failed to outline the field container: ${error?.message || String(error)}`);
          }
        }
      });

      const persistedState = {
        enabled: revealedControls.length > 0,
        revealedControls: dedupeLocators(revealedControls, (locator) => `${locator.index}::${locator.name || ''}`),
        revealedSections: dedupeLocators(revealedSections, (locator) => `${locator.tabIndex}::${locator.sectionIndex}::${locator.name || ''}`),
        revealedTabs: dedupeLocators(revealedTabs, (locator) => `${locator.index}::${locator.name || ''}`)
      };

      if (persistedState.enabled) {
        window[hiddenFieldStateKey] = persistedState;
      } else {
        delete window[hiddenFieldStateKey];
      }

      return {
        hasXrm: true,
        hiddenFieldsVisible: persistedState.enabled,
        changedFieldNames: Array.from(changedFieldNames),
        errors
      };
    }

    (existingState.revealedControls || []).forEach((locator) => {
      const control = findControlByLocator(controls, locator);
      if (!control) {
        return;
      }

      const controlName = getItemName(control);
      const controlLabel = controlName || `Control at index ${locator.index}`;

      if (typeof control.clearNotification === 'function') {
        try {
          control.clearNotification(hiddenFieldNotificationId);
        } catch (error) {
          errors.push(`Failed to clear the hidden-field badge for ${controlLabel}: ${error?.message || String(error)}`);
        }
      }

      if (controlName) {
        try {
          unmarkControlContainer(controlName);
        } catch (error) {
          errors.push(`Failed to remove the field outline for ${controlLabel}: ${error?.message || String(error)}`);
        }
      }

      try {
        if (typeof control.getVisible === 'function' && typeof control.setVisible === 'function' && control.getVisible()) {
          control.setVisible(false);
          changedFieldNames.add(controlLabel);
        }
      } catch (error) {
        errors.push(`Failed to restore visibility for ${controlLabel}: ${error?.message || String(error)}`);
      }
    });

    (existingState.revealedSections || []).forEach((locator) => {
      const section = findSectionByLocator(tabs, locator);
      if (!section || typeof section.getVisible !== 'function' || typeof section.setVisible !== 'function') {
        return;
      }

      try {
        if (section.getVisible()) {
          section.setVisible(false);
        }
      } catch (error) {
        const sectionLabel = locator.name || `Section ${locator.sectionIndex}`;
        errors.push(`Failed to restore hidden section ${sectionLabel}: ${error?.message || String(error)}`);
      }
    });

    (existingState.revealedTabs || []).forEach((locator) => {
      const tab = findTabByLocator(tabs, locator);
      if (!tab || typeof tab.getVisible !== 'function' || typeof tab.setVisible !== 'function') {
        return;
      }

      try {
        if (tab.getVisible()) {
          tab.setVisible(false);
        }
      } catch (error) {
        const tabLabel = locator.name || `Tab ${locator.index}`;
        errors.push(`Failed to restore hidden tab ${tabLabel}: ${error?.message || String(error)}`);
      }
    });

    clearAllMarkers();
    delete window[hiddenFieldStateKey];

    return {
      hasXrm: true,
      hiddenFieldsVisible: false,
      changedFieldNames: Array.from(changedFieldNames),
      errors
    };
  } catch (error) {
    return {
      hasXrm: false,
      hiddenFieldsVisible: false,
      changedFieldNames: [],
      errors: ['Failed to toggle hidden fields: ' + (error?.message || String(error))]
    };
  }
}

function toggleFieldsOnForm(shouldEnable) {
  try {
    const fieldStateKey = '__powerPilotFieldUnlockState__';

    function getXrmRoot() {
      const candidates = [window, window.top, window.parent].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (candidate && candidate.Xrm) {
            return candidate.Xrm;
          }
        } catch (e) {
          // Ignore cross-origin exceptions
        }
      }
      return null;
    }

    const xrm = getXrmRoot();
    if (!xrm) {
      return {
        hasXrm: false,
        changedFieldNames: [],
        errors: []
      };
    }

    const controls = xrm?.Page?.ui?.controls?.get?.() || [];
    const existingState = window[fieldStateKey] || {
      enabled: false,
      lockedControlNames: [],
      lockedControlIndexes: []
    };
    const changedFieldNames = new Set();
    const lockedControlNames = new Set();
    const lockedControlIndexes = new Set();
    const controlsToRelockByName = new Set(existingState.lockedControlNames || []);
    const controlsToRelockByIndex = new Set(existingState.lockedControlIndexes || []);
    const errors = [];

    controls.forEach((control, index) => {
      if (typeof control?.getDisabled !== 'function' || typeof control?.setDisabled !== 'function') {
        return;
      }

      const controlName = typeof control.getName === 'function' ? control.getName() : '';
      const isDisabled = control.getDisabled();

      if (shouldEnable) {
        if (!isDisabled) {
          return;
        }

        try {
          control.setDisabled(false);
          if (controlName) {
            lockedControlNames.add(controlName);
            changedFieldNames.add(controlName);
          } else {
            lockedControlIndexes.add(index);
            changedFieldNames.add(`control-index-${index}`);
          }
        } catch (error) {
          const label = controlName || `Control at index ${index}`;
          errors.push(`Failed to unlock ${label}: ${error?.message || String(error)}`);
        }
        return;
      }

      const shouldRelock = (controlName && controlsToRelockByName.has(controlName)) ||
        (!controlName && controlsToRelockByIndex.has(index));
      if (!shouldRelock || isDisabled) {
        return;
      }

      try {
        control.setDisabled(true);
        if (controlName) {
          changedFieldNames.add(controlName);
        } else {
          changedFieldNames.add(`control-index-${index}`);
        }
      } catch (error) {
        const label = controlName || `Control at index ${index}`;
        errors.push(`Failed to restore lock state for ${label}: ${error?.message || String(error)}`);
      }
    });

    if (shouldEnable) {
      window[fieldStateKey] = {
        enabled: true,
        lockedControlNames: Array.from(lockedControlNames),
        lockedControlIndexes: Array.from(lockedControlIndexes)
      };
    } else {
      delete window[fieldStateKey];
    }

    return {
      hasXrm: true,
      changedFieldNames: Array.from(changedFieldNames),
      errors
    };
  } catch (error) {
    return {
      hasXrm: false,
      changedFieldNames: [],
      errors: ['Failed to toggle form fields: ' + (error?.message || String(error))]
    };
  }
}

function toggleBusinessRequiredFieldsOnForm(shouldEnable) {
  try {
    const requiredStateKey = '__powerPilotRequiredFieldState__';

    function getXrmRoot() {
      const candidates = [window, window.top, window.parent].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (candidate && candidate.Xrm) {
            return candidate.Xrm;
          }
        } catch (e) {
          // Ignore cross-origin exceptions
        }
      }
      return null;
    }

    const xrm = getXrmRoot();
    if (!xrm) {
      return {
        hasXrm: false,
        changedFieldNames: [],
        errors: []
      };
    }

    const attributes = xrm?.Page?.data?.entity?.attributes?.get?.() || [];
    const existingState = window[requiredStateKey] || {
      enabled: false,
      requiredAttributeNames: []
    };
    
    const changedFieldNames = new Set();
    const requiredAttributeNames = new Set();
    const attributesToRestore = new Set(existingState.requiredAttributeNames || []);
    const errors = [];

    attributes.forEach((attribute) => {
      if (typeof attribute?.getRequiredLevel !== 'function' || typeof attribute?.setRequiredLevel !== 'function') {
        return;
      }

      const attributeName = typeof attribute.getName === 'function' ? attribute.getName() : null;
      const currentLevel = attribute.getRequiredLevel();

      if (shouldEnable) {
        if (currentLevel !== 'required') {
          return;
        }

        try {
          attribute.setRequiredLevel('none');
          if (attributeName) {
            requiredAttributeNames.add(attributeName);
            changedFieldNames.add(attributeName);
          }
        } catch (error) {
          const label = attributeName || 'Unknown Attribute';
          errors.push(`Failed to change ${label} to optional: ${error?.message || String(error)}`);
        }
        return;
      }

      // Restoring
      if (!attributeName || !attributesToRestore.has(attributeName)) {
        return;
      }

      try {
        if (currentLevel !== 'required') {
          attribute.setRequiredLevel('required');
          changedFieldNames.add(attributeName);
        }
      } catch (error) {
        const label = attributeName;
        errors.push(`Failed to restore required level for ${label}: ${error?.message || String(error)}`);
      }
    });

    if (shouldEnable) {
      window[requiredStateKey] = {
        enabled: true,
        requiredAttributeNames: Array.from(requiredAttributeNames)
      };
    } else {
      delete window[requiredStateKey];
    }

    return {
      hasXrm: true,
      changedFieldNames: Array.from(changedFieldNames),
      errors
    };
  } catch (error) {
    return {
      hasXrm: false,
      changedFieldNames: [],
      errors: ['Failed to update required levels: ' + (error?.message || String(error))]
    };
  }
}

function toggleSchemaNamesOnForm(shouldEnable) {
  try {
    const schemaStateKey = '__powerPilotSchemaNamesState__';

    function getXrmRoot() {
      const candidates = [window, window.top, window.parent].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (candidate && candidate.Xrm) {
            return candidate.Xrm;
          }
        } catch (e) {
          // Ignore cross-origin exceptions
        }
      }
      return null;
    }

    function escapeSelectorValue(value) {
      return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
    }

    function normalizeText(value) {
      return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/\*/g, '')
        .trim()
        .toLowerCase();
    }

    function getOwnTextContent(element) {
      if (!element || !element.childNodes) {
        return '';
      }

      return Array.from(element.childNodes)
        .filter((node) => node && node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent || '')
        .join(' ');
    }

    function removeExistingMarkers(documentRef) {
      Array.from(documentRef.querySelectorAll('[data-power-pilot-schema-name="true"]')).forEach((marker) => marker.remove());
    }

    function getSchemaState() {
      const existingState = window[schemaStateKey];
      if (existingState) {
        return existingState;
      }

      const nextState = {
        enabled: false,
        renderTimer: null,
        schemaCopyHandler: null,
        clickHandler: null,
        keydownHandler: null,
        scrollHandler: null,
        selectionObserver: null
      };
      window[schemaStateKey] = nextState;
      return nextState;
    }

    function destroySchemaState(state) {
      if (state.renderTimer) {
        window.clearTimeout(state.renderTimer);
        state.renderTimer = null;
      }

      if (state.clickHandler) {
        document.removeEventListener('click', state.clickHandler, true);
        state.clickHandler = null;
      }

      if (state.schemaCopyHandler) {
        document.removeEventListener('click', state.schemaCopyHandler, true);
        state.schemaCopyHandler = null;
      }

      if (state.keydownHandler) {
        document.removeEventListener('keydown', state.keydownHandler, true);
        state.keydownHandler = null;
      }

      if (state.scrollHandler) {
        window.removeEventListener('scroll', state.scrollHandler, true);
        state.scrollHandler = null;
      }

      if (state.selectionObserver) {
        state.selectionObserver.disconnect();
        state.selectionObserver = null;
      }

      state.enabled = false;
      delete window[schemaStateKey];
    }

    function getActiveTabPanels() {
      const panels = new Set();
      const activeTabs = Array.from(document.querySelectorAll('[role="tab"][aria-selected="true"]'))
        .filter((tab) => isVisibleElement(tab));

      activeTabs.forEach((tab) => {
        const controlsId = tab.getAttribute('aria-controls');
        if (controlsId) {
          const panel = document.getElementById(controlsId);
          if (panel) {
            panels.add(panel);
          }
        }

        const tabId = tab.id;
        if (tabId) {
          Array.from(document.querySelectorAll(`[aria-labelledby="${escapeSelectorValue(tabId)}"]`))
            .forEach((panel) => panels.add(panel));
        }
      });

      return Array.from(panels).filter((panel) => isVisibleElement(panel));
    }

    function isElementInActiveTabPanel(element, activePanels) {
      if (!element || activePanels.length === 0) {
        return false;
      }

      return activePanels.some((panel) => panel === element || panel.contains(element));
    }

    function getElementContextScore(element, activePanels) {
      if (!element || !(element instanceof Element)) {
        return Number.NEGATIVE_INFINITY;
      }

      if (element.closest('[hidden], [aria-hidden="true"]')) {
        return Number.NEGATIVE_INFINITY;
      }

      let score = 0;

      if (activePanels.length > 0) {
        score += isElementInActiveTabPanel(element, activePanels) ? 100 : -100;
      }

      return score;
    }

    function isVisibleElement(element) {
      if (!element || !(element instanceof Element)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function ensureSchemaStyles(documentRef) {
      const styleId = 'power-pilot-schema-name-styles';
      if (documentRef.getElementById(styleId)) {
        return;
      }

      const style = documentRef.createElement('style');
      style.id = styleId;
      // Render schema names as a small, subtle line under the field's display label.
      style.textContent = `
        .power-pilot-schema-name {
          display: block;
          width: 100%;
          flex-basis: 100%;
          margin: 2px 0 0 0; /* minimal spacing so it appears directly under the label */
          color: #6b7280; /* muted color */
          font-size: 10px; /* tiny font */
          line-height: 1.1;
          font-weight: 400;
          word-break: break-word;
          cursor: pointer;
        }
        .power-pilot-schema-name:hover { color: #2563eb; text-decoration: underline; }
        /* Ensure the label and schema name stack nicely */
        .power-pilot-schema-name + * { margin-top: 0; }
      `;
      (documentRef.head || documentRef.documentElement).appendChild(style);
    }

    async function writeSchemaNameToClipboard(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }

      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();

      if (!copied) {
        throw new Error(`Unable to copy schema name ${text}.`);
      }
    }

    function hasInteractiveFieldContent(element) {
      return !!(
        element &&
        element.querySelector &&
        element.querySelector('input, textarea, select, button, [role="textbox"], [contenteditable="true"], [data-id*=".fieldControl"], [id*=".fieldControl"]')
      );
    }

    function findFieldHost(startElement, rootLimit) {
      let current = startElement;

      while (current && current !== document.body) {
        const dataId = current.getAttribute && current.getAttribute('data-id');
        const id = current.getAttribute && current.getAttribute('id');
        const rect = typeof current.getBoundingClientRect === 'function' ? current.getBoundingClientRect() : null;
        const hasUsefulSize = !!rect && rect.width > 120;
        const hasChildren = current.children && current.children.length > 0;
        const hasFieldControlIdentifier = !!(
          dataId && (dataId.includes('.fieldControl') || dataId.includes('.fieldControl-container')) ||
          id && id.includes('.fieldControl')
        );
        const hasFieldLikeContent = hasInteractiveFieldContent(current);

        if (
          hasFieldControlIdentifier ||
          (hasUsefulSize && hasChildren && hasFieldLikeContent)
        ) {
          return current;
        }

        if (rootLimit && current === rootLimit) {
          break;
        }

        current = current.parentElement;
      }

      return null;
    }

    function isBetterLabelCandidate(candidate, existing) {
      if (!existing) {
        return true;
      }

      if (candidate.hasOwnText !== existing.hasOwnText) {
        return candidate.hasOwnText;
      }

      return candidate.fullText.length < existing.fullText.length;
    }

    function buildLabelIndex(host) {
      const exact = new Map();
      const ordered = [];
      const candidates = Array.from(host.querySelectorAll('label, span, div'));

      candidates
        .filter((candidate) => isVisibleElement(candidate))
        .filter((candidate) => !hasInteractiveFieldContent(candidate))
        .forEach((candidate) => {
          const ownText = normalizeText(getOwnTextContent(candidate));
          const fullText = normalizeText(candidate.textContent);
          const matchText = ownText || fullText;
          if (!matchText) {
            return;
          }

          const labelEntry = {
            node: candidate,
            matchText,
            hasOwnText: !!ownText,
            fullText
          };

          const existing = exact.get(matchText);
          if (isBetterLabelCandidate(labelEntry, existing)) {
            exact.set(matchText, labelEntry);
          }

          ordered.push(labelEntry);
        });

      ordered.sort((left, right) => {
        if (left.hasOwnText !== right.hasOwnText) {
          return left.hasOwnText ? -1 : 1;
        }

        return left.fullText.length - right.fullText.length;
      });

      return { exact, ordered };
    }

    function findLabelNode(hostInfo, labelText) {
      const normalizedLabel = normalizeText(labelText);
      if (!normalizedLabel || !hostInfo) {
        return null;
      }

      const exactMatch = hostInfo.labelIndex.exact.get(normalizedLabel);
      if (exactMatch) {
        return {
          node: exactMatch.node,
          isExact: true
        };
      }

      const prefixMatch = hostInfo.labelIndex.ordered.find((candidate) => {
        return candidate.hasOwnText &&
          candidate.matchText.length <= normalizedLabel.length + 8 &&
          candidate.matchText.startsWith(normalizedLabel);
      });

      return prefixMatch
        ? {
            node: prefixMatch.node,
            isExact: false
          }
        : null;
    }

    function collectLookupNamesFromAttribute(rawValue, attributeName) {
      const value = String(rawValue || '');
      const names = new Map();
      if (!value) {
        return [];
      }

      function addName(name, weight) {
        if (!name) {
          return;
        }

        const existingWeight = names.get(name);
        if (existingWeight === undefined || weight > existingWeight) {
          names.set(name, weight);
        }
      }

      addName(value, 10);

      if (attributeName === 'data-id' || attributeName === 'id') {
        const fieldControlMatch = value.match(/^([A-Za-z_][\w]*)\.fieldControl(?:-container)?/);
        if (fieldControlMatch && fieldControlMatch[1]) {
          addName(fieldControlMatch[1], 100);
        }

        const leadingTokenMatch = value.match(/^([A-Za-z_][\w]*)[.:]/);
        if (leadingTokenMatch && leadingTokenMatch[1]) {
          addName(leadingTokenMatch[1], 60);
        }
      }

      if (attributeName === 'name') {
        const nameSuffixMatch = value.match(/^([A-Za-z_][\w]*?)_[^_]+$/);
        if (nameSuffixMatch && nameSuffixMatch[1]) {
          addName(nameSuffixMatch[1], 50);
        }
      }

      return Array.from(names.entries()).map(([name, weight]) => ({ name, weight }));
    }

    function buildFieldCandidateIndex(searchRoots, activePanels) {
      const hostInfoByHost = new Map();
      const candidatesByControlName = new Map();

      function addFieldCandidate(controlName, candidate) {
        if (!controlName) {
          return;
        }

        const existing = candidatesByControlName.get(controlName) || [];
        const alreadyPresent = existing.some((entry) => entry.element === candidate.element && entry.hostInfo === candidate.hostInfo);
        if (!alreadyPresent) {
          existing.push(candidate);
          candidatesByControlName.set(controlName, existing);
        }
      }

      function getOrCreateHostInfo(host) {
        const existing = hostInfoByHost.get(host);
        if (existing) {
          return existing;
        }

        const hostInfo = {
          host,
          score: getElementContextScore(host, activePanels),
          labelIndex: buildLabelIndex(host),
          hasDirectFieldControlIdentifier: !!(
            host.getAttribute('data-id') && host.getAttribute('data-id').includes('.fieldControl') ||
            host.getAttribute('id') && host.getAttribute('id').includes('.fieldControl')
          )
        };
        hostInfoByHost.set(host, hostInfo);
        return hostInfo;
      }

      searchRoots.forEach((root) => {
        if (!root || !isVisibleElement(root)) {
          return;
        }

        const candidates = Array.from(root.querySelectorAll('[data-id], [id], [name], input, textarea, select, button, [role="textbox"], [contenteditable="true"]'));
        candidates.forEach((element) => {
          if (!element || !(element instanceof Element) || !isVisibleElement(element)) {
            return;
          }

          const host = findFieldHost(element, root);
          if (!host || !isVisibleElement(host)) {
            return;
          }

          const hostInfo = getOrCreateHostInfo(host);
          if (hostInfo.score < 0) {
            return;
          }

          ['data-id', 'id', 'name'].forEach((attributeName) => {
            collectLookupNamesFromAttribute(element.getAttribute(attributeName), attributeName)
              .forEach(({ name, weight }) => {
                addFieldCandidate(name, {
                  element,
                  hostInfo,
                  score: weight + (hostInfo.hasDirectFieldControlIdentifier ? 30 : 0)
                });
              });
          });
        });
      });

      candidatesByControlName.forEach((candidates) => {
        candidates.sort((left, right) => right.score - left.score);
      });

      return candidatesByControlName;
    }

    function getControlLookupNames(control) {
      const names = [];
      const controlName = typeof control?.getName === 'function' ? control.getName() : '';
      if (controlName) {
        names.push(controlName);
      }

      const attribute = typeof control?.getAttribute === 'function' ? control.getAttribute() : null;
      const attributeName = attribute && typeof attribute.getName === 'function' ? attribute.getName() : '';
      if (attributeName) {
        names.push(attributeName);
      }

      return Array.from(new Set(names.filter(Boolean)));
    }

    function findHostForControl(controlNames, controlLabel, candidatesByControlName) {
      const hostCandidates = [];
      const seenHostKeys = new Set();

      for (const controlName of controlNames) {
        const matchingCandidates = candidatesByControlName.get(controlName) || [];
        matchingCandidates.forEach((candidate) => {
          const labelMatch = findLabelNode(candidate.hostInfo, controlLabel);
          if (!labelMatch) {
            return;
          }

          const hostKey = `${controlName}::${candidate.hostInfo.host.getAttribute('data-id') || candidate.hostInfo.host.getAttribute('id') || ''}`;
          if (seenHostKeys.has(hostKey)) {
            return;
          }
          seenHostKeys.add(hostKey);

          hostCandidates.push({
            host: candidate.hostInfo.host,
            labelNode: labelMatch.node,
            score: candidate.score + candidate.hostInfo.score + (labelMatch.isExact ? 80 : 30)
          });
        });
      }

      hostCandidates.sort((left, right) => right.score - left.score);
      return hostCandidates.length > 0 ? hostCandidates[0] : null;
    }

    function renderSchemaNamesForActiveTab(activePanelsOverride) {
      removeExistingMarkers(document);

      ensureSchemaStyles(document);

      const controls = xrm?.Page?.ui?.controls?.get?.() || [];
      const activePanels = Array.isArray(activePanelsOverride) ? activePanelsOverride : getActiveTabPanels();
      const searchRoots = activePanels.length > 0 ? activePanels : [document.body];
      const candidatesByControlName = buildFieldCandidateIndex(searchRoots, activePanels);
      const changedFieldNames = [];
      const errors = [];
      const usedLabelNodes = new Set();

      controls.forEach((control) => {
        const controlNames = getControlLookupNames(control);
        const controlName = controlNames[0] || '';
        const controlLabel = typeof control?.getLabel === 'function' ? control.getLabel() : controlName;
        const schemaName = controlNames[controlNames.length - 1] || controlName;

        if (!schemaName) {
          return;
        }

        try {
          const hostResult = findHostForControl(controlNames, controlLabel, candidatesByControlName);
          if (!hostResult || !hostResult.host || hostResult.score < 0) {
            return;
          }

          if (usedLabelNodes.has(hostResult.labelNode)) {
            return;
          }

          if (hostResult.host.querySelector(`[data-power-pilot-schema-for="${escapeSelectorValue(schemaName)}"]`)) {
            return;
          }

          const marker = document.createElement('span');
          marker.className = 'power-pilot-schema-name';
          marker.setAttribute('data-power-pilot-schema-name', 'true');
          marker.setAttribute('data-power-pilot-schema-for', schemaName);
          marker.textContent = schemaName;
          marker.setAttribute('title', `Click to copy schema name ${schemaName}`);
          marker.setAttribute('aria-label', `Schema name ${schemaName}. Click to copy.`);

          marker.setAttribute('data-power-pilot-schema-scope', 'label');
          hostResult.labelNode.appendChild(marker);

          marker.style.pointerEvents = 'auto';
          marker.style.userSelect = 'text';
          usedLabelNodes.add(hostResult.labelNode);
          changedFieldNames.push(schemaName);
        } catch (error) {
          errors.push(`Failed to show schema name for ${schemaName}: ${error?.message || String(error)}`);
        }
      });

      return {
        hasXrm: true,
        schemaNamesVisible: changedFieldNames.length > 0,
        changedFieldNames,
        errors
      };
    }

    function scheduleSchemaRender(state) {
      if (!state.enabled || state.renderTimer) {
        return;
      }

      state.renderTimer = window.setTimeout(() => {
        state.renderTimer = null;
        if (!state.enabled) {
          return;
        }

        renderSchemaNamesForActiveTab();
      }, 120);
    }

    function installSchemaRefresh(state) {
      if (!state.schemaCopyHandler) {
        state.schemaCopyHandler = (event) => {
          const marker = event.target instanceof Element
            ? event.target.closest('[data-power-pilot-schema-name="true"]')
            : null;
          if (!marker) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          const schemaName = marker.getAttribute('data-power-pilot-schema-for') || marker.textContent || '';
          if (!schemaName) {
            return;
          }

          writeSchemaNameToClipboard(schemaName).catch(() => {});
        };
        document.addEventListener('click', state.schemaCopyHandler, true);
      }

      if (!state.clickHandler) {
        state.clickHandler = (event) => {
          if (!state.enabled || !(event.target instanceof Element)) {
            return;
          }

          if (event.target.closest('[role="tab"]')) {
            scheduleSchemaRender(state);
          }
        };
        document.addEventListener('click', state.clickHandler, true);
      }

      if (!state.keydownHandler) {
        state.keydownHandler = (event) => {
          if (!state.enabled || !(event.target instanceof Element)) {
            return;
          }

          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
            return;
          }

          if (event.target.closest('[role="tab"]') || event.target.closest('[role="tablist"]')) {
            scheduleSchemaRender(state);
          }
        };
        document.addEventListener('keydown', state.keydownHandler, true);
      }

      if (!state.scrollHandler) {
        state.scrollHandler = () => {
          if (!state.enabled) {
            return;
          }

          scheduleSchemaRender(state);
        };
        window.addEventListener('scroll', state.scrollHandler, true);
      }

      if (!state.selectionObserver && document.body) {
        state.selectionObserver = new MutationObserver((mutations) => {
          if (!state.enabled) {
            return;
          }

          const hasRelevantChange = mutations.some((mutation) => {
            if (mutation.type === 'attributes') {
              return mutation.target instanceof Element &&
                mutation.target.getAttribute('role') === 'tab';
            }

            return mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0);
          });

          if (hasRelevantChange) {
            scheduleSchemaRender(state);
          }
        });

        state.selectionObserver.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['aria-selected']
        });
      }
    }

    const xrm = getXrmRoot();
    if (!xrm) {
      return {
        hasXrm: false,
        schemaNamesVisible: false,
        changedFieldNames: [],
        errors: []
      };
    }

    const schemaState = getSchemaState();
    const existingMarkers = Array.from(document.querySelectorAll('[data-power-pilot-schema-name="true"]'));
    if (!shouldEnable) {
      const changedFieldNames = existingMarkers
        .map((marker) => marker.getAttribute('data-power-pilot-schema-for'))
        .filter(Boolean);

      removeExistingMarkers(document);
      destroySchemaState(schemaState);

      return {
        hasXrm: true,
        schemaNamesVisible: false,
        changedFieldNames,
        errors: []
      };
    }

    schemaState.enabled = true;
    installSchemaRefresh(schemaState);

    const renderResult = renderSchemaNamesForActiveTab();
    return {
      hasXrm: true,
      schemaNamesVisible: true,
      changedFieldNames: renderResult.changedFieldNames,
      errors: renderResult.errors
    };
  } catch (error) {
    return {
      hasXrm: false,
      schemaNamesVisible: false,
      changedFieldNames: [],
      errors: ['Failed to toggle schema names: ' + (error?.message || String(error))]
    };
  }
}

function getCurrentEntityDetails() {
  try {
    const schemaStateKey = '__powerPilotSchemaNamesState__';

    function getXrmRoot() {
      const candidates = [window, window.top, window.parent].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (candidate && candidate.Xrm) {
            return candidate.Xrm;
          }
        } catch (e) {
          // Ignore cross-origin exceptions
        }
      }
      return null;
    }

    const xrm = getXrmRoot();
    const formContext = xrm && xrm.Page && xrm.Page.data ? xrm.Page.data.entity : null;
    let entityName = '';

    try {
      const urlParams = new URLSearchParams(window.location.search);
      entityName =
        urlParams.get('etn') ||
        urlParams.get('entityname') ||
        urlParams.get('entity') ||
        (formContext && typeof formContext.getEntityName === 'function' ? formContext.getEntityName() : '') ||
        '';
    } catch (_error) {
      entityName = formContext && typeof formContext.getEntityName === 'function'
        ? formContext.getEntityName()
        : '';
    }

    return {
      url: location.href,
      entityName,
      hasXrm: !!xrm,
      schemaNamesVisible: !!window[schemaStateKey]?.enabled,
      fieldsUnlocked: !!window.__powerPilotFieldUnlockState__?.enabled,
      hiddenFieldsVisible: !!window.__powerPilotHiddenFieldState__?.enabled,
      mandatoryFieldsDisabled: !!window.__powerPilotRequiredFieldState__?.enabled,
      errors: []
    };
  } catch (error) {
    return {
      url: location.href,
      entityName: '',
      hasXrm: false,
      schemaNamesVisible: false,
      fieldsUnlocked: false,
      hiddenFieldsVisible: false,
      mandatoryFieldsDisabled: false,
      errors: ['Failed to detect entity: ' + (error?.message || String(error))]
    };
  }
}

// Exports all attributes defined on the entity (via the Web API EntityDefinitions
// endpoint), not just the fields present on the current form.
async function collectAllFieldMetadata() {
  try {
    function getXrmRoot() {
      const candidates = [window, window.top, window.parent].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (candidate && candidate.Xrm) {
            return candidate.Xrm;
          }
        } catch (e) {
          // Ignore cross-origin exceptions
        }
      }
      return null;
    }

    function getLocalizedLabel(labelNode) {
      if (!labelNode) {
        return '';
      }

      if (labelNode.UserLocalizedLabel && labelNode.UserLocalizedLabel.Label) {
        return labelNode.UserLocalizedLabel.Label;
      }

      const localizedLabels = labelNode.LocalizedLabels;
      if (Array.isArray(localizedLabels) && localizedLabels.length > 0) {
        return localizedLabels[0] && localizedLabels[0].Label ? localizedLabels[0].Label : '';
      }

      return '';
    }

    function getApiVersionCandidates(xrmRoot) {
      const candidates = [];
      const globalContext = xrmRoot && xrmRoot.Utility && typeof xrmRoot.Utility.getGlobalContext === 'function'
        ? xrmRoot.Utility.getGlobalContext()
        : null;
      const rawVersion = globalContext && typeof globalContext.getVersion === 'function'
        ? globalContext.getVersion()
        : null;
      const normalizedVersion = rawVersion
        ? `v${String(rawVersion).split('.').slice(0, 2).join('.')}`
        : null;

      if (normalizedVersion) {
        candidates.push(normalizedVersion);
      }

      ['v9.2', 'v9.1', 'v9.0', 'v8.2', 'v8.1'].forEach((version) => {
        if (!candidates.includes(version)) {
          candidates.push(version);
        }
      });

      return candidates;
    }

    async function fetchAllAttributes(clientUrl, entityName, xrmRoot) {
      const apiVersions = getApiVersionCandidates(xrmRoot);
      let lastErrorMessage = null;

      for (const apiVersion of apiVersions) {
        try {
          const url = `${clientUrl}/api/data/${apiVersion}/EntityDefinitions(LogicalName='${entityName}')/Attributes?$select=LogicalName,SchemaName,DisplayName,AttributeType`;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0'
            },
            credentials: 'include'
          });

          if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            throw new Error(responseText || `${response.status} ${response.statusText}`);
          }

          const payload = await response.json();
          return payload.value || [];
        } catch (error) {
          lastErrorMessage = error?.message || String(error);
        }
      }

      throw new Error(lastErrorMessage || 'No supported Dataverse Web API version was available');
    }

    const xrm = getXrmRoot();
    const formContext = xrm && xrm.Page && xrm.Page.data ? xrm.Page.data.entity : null;

    let entityName = '';
    try {
      const urlParams = new URLSearchParams(window.location.search);
      entityName =
        urlParams.get('etn') ||
        urlParams.get('entityname') ||
        urlParams.get('entity') ||
        (formContext && typeof formContext.getEntityName === 'function' ? formContext.getEntityName() : '') ||
        '';
    } catch (_error) {
      entityName = formContext && typeof formContext.getEntityName === 'function'
        ? formContext.getEntityName()
        : '';
    }

    if (!xrm || !entityName) {
      return {
        entityName,
        hasXrm: !!xrm,
        fields: [],
        errors: []
      };
    }

    if (!xrm.Utility || typeof xrm.Utility.getGlobalContext !== 'function') {
      return {
        entityName,
        hasXrm: true,
        fields: [],
        errors: ['Unable to reach the Dataverse Web API from this page.']
      };
    }

    const clientUrl = xrm.Utility.getGlobalContext().getClientUrl();
    const attributes = await fetchAllAttributes(clientUrl, entityName, xrm);

    const fields = attributes
      .filter((attribute) => attribute && attribute.LogicalName)
      .map((attribute) => ({
        displayName: getLocalizedLabel(attribute.DisplayName) || attribute.LogicalName,
        schemaName: attribute.SchemaName || attribute.LogicalName,
        dataType: attribute.AttributeType || ''
      }));

    return {
      entityName,
      hasXrm: true,
      fields,
      errors: fields.length === 0 ? ['No fields found for this entity.'] : []
    };
  } catch (error) {
    return {
      entityName: '',
      hasXrm: false,
      fields: [],
      errors: ['Failed to collect field metadata: ' + (error?.message || String(error))]
    };
  }
}

async function collectOptionSetValues() {
  try {
    const results = [];
    const seenNames = new Set();
    const currentValueMap = {};

    function getXrmRoot() {
      const candidates = [window, window.top, window.parent].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (candidate && candidate.Xrm) {
            return candidate.Xrm;
          }
        } catch (e) {
          // Ignore cross-origin exceptions
        }
      }
      return null;
    }

    function getLocalizedLabel(labelNode) {
      if (!labelNode) {
        return null;
      }

      if (labelNode.UserLocalizedLabel && labelNode.UserLocalizedLabel.Label) {
        return labelNode.UserLocalizedLabel.Label;
      }

      const localizedLabels = labelNode.LocalizedLabels;
      if (Array.isArray(localizedLabels) && localizedLabels.length > 0) {
        return localizedLabels[0] && localizedLabels[0].Label ? localizedLabels[0].Label : null;
      }

      return null;
    }

    function isOptionSetAttribute(attribute) {
      if (!attribute || typeof attribute.getAttributeType !== 'function') {
        return false;
      }

      const attributeType = String(attribute.getAttributeType()).toLowerCase();
      return ['picklist', 'state', 'status', 'multiselectpicklist'].includes(attributeType);
    }

    function resolveFieldLabel(attribute, xrmRoot, name) {
      const attributeLabel = attribute && typeof attribute.getLabel === 'function' ? attribute.getLabel() : null;
      if (attributeLabel) {
        return attributeLabel;
      }

      const control = xrmRoot && xrmRoot.Page && typeof xrmRoot.Page.getControl === 'function'
        ? xrmRoot.Page.getControl(name)
        : null;
      return control && typeof control.getLabel === 'function' ? control.getLabel() : name;
    }

    function buildOptionList(attribute, selectedValue) {
      if (typeof attribute.getOptions !== 'function') {
        return [];
      }

      const options = attribute.getOptions() || [];
      return options.map((option) => {
        const value = option && option.value;
        const text = (option && (option.text || option.label)) || `Option ${value}`;
        const isSelected = Array.isArray(selectedValue)
          ? selectedValue.includes(value)
          : selectedValue === value;

        return {
          value,
          text,
          isSelected,
          state: option ? option.state : undefined,
          defaultStatus: option ? option.defaultStatus : undefined
        };
      });
    }

    function getApiVersionCandidates(xrmRoot) {
      const candidates = [];
      const globalContext = xrmRoot && xrmRoot.Utility && typeof xrmRoot.Utility.getGlobalContext === 'function'
        ? xrmRoot.Utility.getGlobalContext()
        : null;
      const rawVersion = globalContext && typeof globalContext.getVersion === 'function'
        ? globalContext.getVersion()
        : null;
      const normalizedVersion = rawVersion
        ? `v${String(rawVersion).split('.').slice(0, 2).join('.')}`
        : null;

      if (normalizedVersion) {
        candidates.push(normalizedVersion);
      }

      ['v9.2', 'v9.1', 'v9.0', 'v8.2', 'v8.1'].forEach((version) => {
        if (!candidates.includes(version)) {
          candidates.push(version);
        }
      });

      return candidates;
    }

    async function fetchMetadataWithVersionFallback(clientUrl, entityName, xrmRoot) {
      const apiVersions = getApiVersionCandidates(xrmRoot);
      const metadataTypes = [
        'PicklistAttributeMetadata',
        'MultiSelectPicklistAttributeMetadata',
        'StateAttributeMetadata',
        'StatusAttributeMetadata'
      ];
      let lastErrorMessage = null;

      for (const apiVersion of apiVersions) {
        try {
          const responses = await Promise.all(metadataTypes.map(async (metadataType) => {
            const url = `${clientUrl}/api/data/${apiVersion}/EntityDefinitions(LogicalName='${entityName}')/Attributes/Microsoft.Dynamics.CRM.${metadataType}?$select=LogicalName,DisplayName,AttributeType&$expand=OptionSet,GlobalOptionSet`;
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0'
              },
              credentials: 'include'
            });

            if (!response.ok) {
              const responseText = await response.text().catch(() => '');
              throw new Error(responseText || `${response.status} ${response.statusText}`);
            }

            return response.json();
          }));

          return {
            value: responses.flatMap((payload) => payload?.value || [])
          };
        } catch (error) {
          lastErrorMessage = error?.message || String(error);
          console.log('[D365-Ext] Metadata lookup failed for API version:', apiVersion, lastErrorMessage);
        }
      }

      throw new Error(lastErrorMessage || 'No supported Dataverse Web API version was available');
    }

    function addFormField(attribute, xrmRoot) {
      const name = attribute && typeof attribute.getName === 'function' ? attribute.getName() : null;
      if (!name || seenNames.has(name.toLowerCase())) {
        return;
      }

      const currentValue = attribute && typeof attribute.getValue === 'function' ? attribute.getValue() : null;
      const options = buildOptionList(attribute, currentValue);
      if (options.length === 0) {
        return;
      }

      currentValueMap[name] = currentValue;
      results.push({
        name,
        label: resolveFieldLabel(attribute, xrmRoot, name),
        type: String(attribute.getAttributeType ? attribute.getAttributeType() : 'picklist'),
        currentValue,
        options,
        source: 'Form'
      });

      seenNames.add(name.toLowerCase());
    }

    const xrm = getXrmRoot();
    const formContext = xrm && xrm.Page && xrm.Page.data ? xrm.Page.data.entity : null;

    let entityName = null;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      entityName =
        urlParams.get('etn') ||
        urlParams.get('entityname') ||
        urlParams.get('entity') ||
        (formContext && typeof formContext.getEntityName === 'function' ? formContext.getEntityName() : null);
    } catch (_e) {
      entityName = formContext && typeof formContext.getEntityName === 'function' ? formContext.getEntityName() : null;
    }

    if (formContext && formContext.attributes && typeof formContext.attributes.get === 'function') {
      const attributes = formContext.attributes.get() || [];
      attributes.forEach((attribute) => {
        if (isOptionSetAttribute(attribute)) {
          addFormField(attribute, xrm);
        }
      });
    }

    if (entityName && xrm && xrm.Utility && typeof xrm.Utility.getGlobalContext === 'function') {
      try {
        const clientUrl = xrm.Utility.getGlobalContext().getClientUrl();
        const metadata = await fetchMetadataWithVersionFallback(clientUrl, entityName, xrm);
        (metadata.value || []).forEach((attr) => {
          const attributeType = String(attr.AttributeType || '').toLowerCase();
          const isOptionSet = ['picklist', 'state', 'status', 'multiselectpicklist'].includes(attributeType);
          if (!isOptionSet || !attr.LogicalName) {
            return;
          }

          const name = attr.LogicalName;
          const optionSet = attr.OptionSet || attr.GlobalOptionSet;
          const options = (optionSet && optionSet.Options ? optionSet.Options : []).map((option) => ({
            value: option.Value,
            text: getLocalizedLabel(option.Label) || `Option ${option.Value}`,
            isSelected: Array.isArray(currentValueMap[name])
              ? currentValueMap[name].includes(option.Value)
              : currentValueMap[name] === option.Value,
            state: option.State,
            defaultStatus: option.DefaultStatus
          }));

          const metadataField = {
            name,
            label: getLocalizedLabel(attr.DisplayName) || name,
            type: attr.AttributeType,
            currentValue: Object.prototype.hasOwnProperty.call(currentValueMap, name) ? currentValueMap[name] : null,
            options,
            source: 'Metadata'
          };

          const existingIndex = results.findIndex((field) => field.name.toLowerCase() === name.toLowerCase());
          if (existingIndex >= 0) {
            const mergedOptions = mergeOptionsInPage(results[existingIndex].options || [], options);
            results[existingIndex] = {
              ...results[existingIndex],
              label: results[existingIndex].label || metadataField.label,
              type: results[existingIndex].type || metadataField.type,
              options: mergedOptions,
              source: 'Form+Metadata'
            };
          } else if (options.length > 0) {
            results.push(metadataField);
          }

          seenNames.add(name.toLowerCase());
        });
      } catch (_metadataError) {
      }
    }

    return {
      url: location.href,
      entityName,
      hasXrm: !!xrm,
      optionSets: results,
      errors: results.length === 0 ? ['No option set fields found for this entity or form.'] : []
    };
  } catch (error) {
    return {
      url: location.href,
      hasXrm: false,
      optionSets: [],
      errors: ['Failed to collect option sets: ' + error.message]
    };
  }
}

function mergeOptionsInPage(formOptions, metadataOptions) {
  const optionMap = new Map();

  [...formOptions, ...metadataOptions].forEach((option) => {
    const key = String(option.value);
    const existing = optionMap.get(key);

    if (!existing) {
      optionMap.set(key, { ...option });
      return;
    }

    optionMap.set(key, {
      ...existing,
      ...option,
      text: existing.text || option.text,
      isSelected: !!(existing.isSelected || option.isSelected),
      state: option.state !== undefined ? option.state : existing.state,
      defaultStatus: option.defaultStatus !== undefined ? option.defaultStatus : existing.defaultStatus
    });
  });

  return Array.from(optionMap.values()).sort((a, b) => Number(a.value) - Number(b.value));
}

async function showEntityInfo() {
  state.currentView = 'entityInfo';
  updateModeButtons();
  updateSearchPlaceholder();
  updateCopyAllButtonState();
  setStatus('Detecting entity schema name and details...');
  errorsElement.innerHTML = '';
  setActionButtonsDisabled(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Could not find the active tab.');
    }

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'MAIN',
      func: getEntityInfoFromForm
    });

    const responses = frameResults.map((frame) => frame.result).filter(Boolean);
    let validResponse = responses.find((res) => res.found && (res.schemaName || res.logicalName)) ||
      responses.find((res) => res.schemaName || res.logicalName) ||
      responses.find((res) => res.hasXrm) ||
      responses[0];

    if (!validResponse) {
      throw new Error('No response from any frame. Make sure you are on a Dynamics 365 or Power Apps form.');
    }

    if (!validResponse.schemaName && state.selectedEntity && state.selectedEntity !== 'Unknown Entity') {
      validResponse.schemaName = state.selectedEntity;
      validResponse.logicalName = state.selectedEntity.toLowerCase();
      validResponse.displayName = validResponse.displayName || state.selectedEntity;
      validResponse.found = true;
    }

    state.entityInfo = validResponse;

    if (validResponse.schemaName) {
      state.selectedEntity = validResponse.schemaName;
      hydrateEntitySelect(validResponse.schemaName);
      await writeClipboard(validResponse.schemaName);
      setStatus(`Entity Schema Name: <strong class="status-highlight">${escapeHtml(validResponse.schemaName)}</strong>`, validResponse.schemaName);
      flashStatusCopied();
    } else {
      setStatus('Could not detect entity schema name on this page.');
    }

    render();
  } catch (error) {
    const message = error?.message || String(error);
    state.entityInfo = { found: false, error: message };
    render();
    setStatus('Unable to get entity info: ' + message);
  } finally {
    setActionButtonsDisabled(false);
  }
}

async function showRecordId() {
  state.currentView = 'recordId';
  updateModeButtons();
  updateSearchPlaceholder();
  updateCopyAllButtonState();
  setStatus('Detecting Record ID...');
  errorsElement.innerHTML = '';
  setActionButtonsDisabled(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Could not find the active tab.');
    }

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'MAIN',
      func: getRecordIdFromForm
    });

    const responses = frameResults.map((frame) => frame.result).filter(Boolean);
    const validResponse = responses.find((res) => res.cleanId) ||
      responses.find((res) => res.isNewRecord) ||
      responses.find((res) => res.hasXrm) ||
      responses[0];

    if (!validResponse) {
      throw new Error('No response from any frame. Make sure you are on a Dynamics 365 form page.');
    }

    state.recordDetails = validResponse;

    if (validResponse.cleanId) {
      await writeClipboard(validResponse.cleanId);
      setStatus(`Record ID: <strong class="status-highlight">${escapeHtml(validResponse.cleanId)}</strong>`, validResponse.cleanId);
      flashStatusCopied();
    } else if (validResponse.isNewRecord) {
      setStatus('New Record: This record has not been saved yet (no Record ID assigned).');
    } else {
      setStatus('No active record ID found. Open a Dynamics 365 record form and try again.');
    }

    render();
  } catch (error) {
    const message = error?.message || String(error);
    state.recordDetails = { found: false, error: message };
    render();
    setStatus('Unable to get Record ID: ' + message);
  } finally {
    setActionButtonsDisabled(false);
  }
}

function renderEntityInfoView() {
  const info = state.entityInfo;
  if (!info) {
    resultsElement.innerHTML = '<div class="empty-state">No entity info loaded yet. Click ENTITY INFO to inspect.</div>';
    return;
  }

  if (!info.found && !info.schemaName && !info.logicalName) {
    resultsElement.innerHTML = `
      <div class="empty-state">
        <p style="margin: 0 0 6px; font-weight: 700; color: #a73737;">Entity Not Detected</p>
        <span style="font-size: 11px; color: #64779b;">${escapeHtml(info.error || 'Please make sure you are on a Dynamics 365 or Power Apps form or view.')}</span>
      </div>
    `;
    return;
  }

  const schemaName = info.schemaName || info.logicalName || 'Unknown';
  const logicalName = info.logicalName || schemaName.toLowerCase();
  const displayName = info.displayName || schemaName;

  const rows = [
    { label: 'Schema Name', value: schemaName, copyable: true, primary: true },
    { label: 'Logical Name', value: logicalName, copyable: true },
    { label: 'Display Name', value: displayName, copyable: true },
    { label: 'Object Type Code (ETC)', value: info.objectTypeCode !== null && info.objectTypeCode !== undefined ? String(info.objectTypeCode) : '-', copyable: info.objectTypeCode !== null && info.objectTypeCode !== undefined },
    { label: 'Primary ID Attribute', value: info.primaryIdAttribute || (logicalName ? `${logicalName}id` : '-'), copyable: !!info.primaryIdAttribute },
    { label: 'Primary Name Attribute', value: info.primaryNameAttribute || '-', copyable: !!info.primaryNameAttribute },
    { label: 'Entity Type', value: info.isCustomEntity !== null && info.isCustomEntity !== undefined ? (info.isCustomEntity ? 'Custom Table / Entity' : 'System Table / Entity') : '-' }
  ];

  const query = state.searchText;
  const filteredRows = query
    ? rows.filter(r => r.label.toLowerCase().includes(query) || (r.value && r.value.toLowerCase().includes(query)))
    : rows;

  const rowsHtml = filteredRows.length > 0
    ? filteredRows.map(r => renderInfoDetailRow(r)).join('')
    : '<div class="empty-state" style="padding: 10px;">No matching entity details.</div>';

  resultsElement.innerHTML = `
    <div class="inspector-layout">
      <section class="section-card">
        <div class="section-heading-row">
          <h2 class="section-title">Entity Information</h2>
          <span class="section-badge">${escapeHtml(schemaName)}</span>
        </div>
        <div class="plugin-detail">
          <div class="plugin-detail-header">
            <div class="plugin-detail-heading">
              <h3 class="plugin-detail-title">${escapeHtml(displayName)}</h3>
              <p class="plugin-detail-subtitle">Schema: <strong style="color: #1a3b8b;">${escapeHtml(schemaName)}</strong> • Logical: ${escapeHtml(logicalName)}</p>
            </div>
            <div class="plugin-detail-actions">
              <button type="button" class="btn" data-copy-text="${escapeHtml(schemaName)}" data-copy-message="Copied Schema Name ${escapeHtml(schemaName)}!" style="min-height: 28px; padding: 4px 10px; font-size: 11px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>Copy Schema</span>
              </button>
            </div>
          </div>
          <div class="detail-grid">${rowsHtml}</div>
        </div>
      </section>
    </div>
  `;
}

function renderRecordIdView() {
  const details = state.recordDetails;
  if (!details) {
    resultsElement.innerHTML = '<div class="empty-state">No record details loaded yet. Click RECORD ID to inspect.</div>';
    return;
  }

  if (details.isNewRecord) {
    resultsElement.innerHTML = `
      <div class="inspector-layout">
        <section class="section-card">
          <div class="section-heading-row">
            <h2 class="section-title">Record Details</h2>
            <span class="section-badge" style="background: #fef3c7; color: #92400e;">New</span>
          </div>
          <div class="plugin-detail">
            <div class="empty-state" style="border: 1px dashed #fcd34d; background: #fffbeb; padding: 16px 12px;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 6px; display: block;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <h4 style="margin: 0 0 4px; font-size: 13.5px; font-weight: 700; color: #92400e;">New Record (Unsaved)</h4>
              <p style="margin: 0; font-size: 11px; color: #78350f; line-height: 1.45;">This record has not been saved to Dataverse yet, so no Record ID (GUID) has been created. Save the record and click Record Id again.</p>
            </div>
          </div>
        </section>
      </div>
    `;
    return;
  }

  if (!details.cleanId) {
    resultsElement.innerHTML = `
      <div class="empty-state">
        <p style="margin: 0 0 6px; font-weight: 700; color: #a73737;">Record ID Not Found</p>
        <span style="font-size: 11px; color: #64779b;">${escapeHtml(details.error || 'Could not find an active record ID. Make sure you have opened a record form in Dynamics 365 or Power Apps.')}</span>
      </div>
    `;
    return;
  }

  const rows = [
    { label: 'Record ID (Clean GUID)', value: details.cleanId, copyable: true, primary: true },
    { label: 'Formatted GUID', value: details.formattedId, copyable: true },
    { label: 'Entity Schema Name', value: details.entityName || '-', copyable: !!details.entityName },
    { label: 'Record Title', value: details.recordName || '-', copyable: !!details.recordName }
  ];

  if (details.url) {
    rows.push({ label: 'Record URL', value: details.url, copyable: true, isUrl: true });
  }

  const query = state.searchText;
  const filteredRows = query
    ? rows.filter(r => r.label.toLowerCase().includes(query) || (r.value && r.value.toLowerCase().includes(query)))
    : rows;

  const rowsHtml = filteredRows.length > 0
    ? filteredRows.map(r => renderInfoDetailRow(r)).join('')
    : '<div class="empty-state" style="padding: 10px;">No matching record details.</div>';

  resultsElement.innerHTML = `
    <div class="inspector-layout">
      <section class="section-card">
        <div class="section-heading-row">
          <h2 class="section-title">Record Details</h2>
          <span class="section-badge">ID</span>
        </div>
        <div class="plugin-detail">
          <div class="plugin-detail-header">
            <div class="plugin-detail-heading">
              <h3 class="plugin-detail-title" style="font-family: Consolas, monospace; font-size: 12.5px; word-break: break-all; color: #1a3b8b;">${escapeHtml(details.cleanId)}</h3>
              <p class="plugin-detail-subtitle">${escapeHtml(details.recordName ? `${details.recordName} • ` : '')}${escapeHtml(details.entityName || 'Active Record')}</p>
            </div>
            <div class="plugin-detail-actions">
              <button type="button" class="btn" data-copy-text="${escapeHtml(details.cleanId)}" data-copy-message="Copied Record ID ${escapeHtml(details.cleanId)}!" style="min-height: 28px; padding: 4px 10px; font-size: 11px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>Copy ID</span>
              </button>
            </div>
          </div>
          <div class="detail-grid">${rowsHtml}</div>
        </div>
      </section>
    </div>
  `;
}

function renderInfoDetailRow(row) {
  const isPrimary = row.primary;
  const copyBtn = row.copyable && row.value && row.value !== '-'
    ? `
      <button type="button" class="copyable-text" data-copy-text="${escapeHtml(row.value)}" data-copy-message="Copied ${escapeHtml(row.label)}!" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; font-size: 10px; border-radius: 6px; background: #eaf2ff; color: #1d4ed8; cursor: pointer; border: 1px solid #c8dbf4; font-family: inherit; font-weight: 600;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        <span>Copy</span>
      </button>
    `
    : '';

  const valueStyle = isPrimary
    ? 'font-weight: 700; color: #1a3b8b; font-size: 12.5px; font-family: Consolas, monospace;'
    : (row.isUrl ? 'font-size: 11px; word-break: break-all; color: #4361ee;' : 'font-size: 12px;');

  return `
    <div class="detail-row">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
        <span class="detail-label">${escapeHtml(row.label)}</span>
        ${copyBtn}
      </div>
      <div class="detail-value" style="${valueStyle}">${escapeHtml(row.value || '-')}</div>
    </div>
  `;
}

async function getEntityInfoFromForm() {
  try {
    function getXrmRoot() {
      const candidates = [window, window.top, window.parent].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (candidate && candidate.Xrm) {
            return candidate.Xrm;
          }
        } catch (e) {
          // Ignore cross-origin exceptions
        }
      }
      return null;
    }

    const xrm = getXrmRoot();
    const formContext = xrm && xrm.Page && xrm.Page.data ? xrm.Page.data.entity : null;
    let logicalName = '';

    try {
      const urlParams = new URLSearchParams(window.location.search);
      logicalName =
        urlParams.get('etn') ||
        urlParams.get('entityname') ||
        urlParams.get('entity') ||
        (formContext && typeof formContext.getEntityName === 'function' ? formContext.getEntityName() : '') ||
        (xrm?.Utility?.getPageContext?.()?.input?.entityName) ||
        '';
    } catch (_error) {
      logicalName = (formContext && typeof formContext.getEntityName === 'function' ? formContext.getEntityName() : '') ||
        (xrm?.Utility?.getPageContext?.()?.input?.entityName) ||
        '';
    }

    if (!logicalName && !xrm) {
      return {
        hasXrm: false,
        found: false,
        error: 'Xrm is not available. Please open a Dynamics 365 or Power Apps form.'
      };
    }

    let schemaName = logicalName;
    let displayName = '';
    let objectTypeCode = null;
    let primaryIdAttribute = '';
    let primaryNameAttribute = '';
    let isCustomEntity = null;

    if (logicalName && xrm?.Utility && typeof xrm.Utility.getEntityMetadata === 'function') {
      try {
        const metadata = await xrm.Utility.getEntityMetadata(logicalName);
        if (metadata) {
          if (metadata.SchemaName) schemaName = metadata.SchemaName;
          if (metadata.DisplayName) displayName = metadata.DisplayName;
          if (metadata.ObjectTypeCode !== undefined) objectTypeCode = metadata.ObjectTypeCode;
          if (metadata.PrimaryIdAttribute) primaryIdAttribute = metadata.PrimaryIdAttribute;
          if (metadata.PrimaryNameAttribute) primaryNameAttribute = metadata.PrimaryNameAttribute;
          if (metadata.IsCustomEntity !== undefined) isCustomEntity = metadata.IsCustomEntity;
        }
      } catch (_e) {}
    }

    if ((!displayName || schemaName === logicalName) && logicalName && xrm?.Utility?.getGlobalContext) {
      try {
        const clientUrl = xrm.Utility.getGlobalContext().getClientUrl();
        const res = await fetch(
          `${clientUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${logicalName}')?$select=SchemaName,LogicalName,DisplayName,ObjectTypeCode,PrimaryIdAttribute,PrimaryNameAttribute,IsCustomEntity`,
          {
            credentials: 'include',
            headers: { Accept: 'application/json' }
          }
        );
        if (res.ok) {
          const json = await res.json();
          if (json.SchemaName) schemaName = json.SchemaName;
          if (json.DisplayName?.UserLocalizedLabel?.Label) {
            displayName = json.DisplayName.UserLocalizedLabel.Label;
          }
          if (json.ObjectTypeCode !== undefined) objectTypeCode = json.ObjectTypeCode;
          if (json.PrimaryIdAttribute) primaryIdAttribute = json.PrimaryIdAttribute;
          if (json.PrimaryNameAttribute) primaryNameAttribute = json.PrimaryNameAttribute;
          if (json.IsCustomEntity !== undefined) isCustomEntity = json.IsCustomEntity;
        }
      } catch (_e) {}
    }

    try {
      if (xrm?.Page?.ui?.setFormNotification) {
        xrm.Page.ui.setFormNotification(`[Power Pilot] Entity Schema Name: ${schemaName || logicalName}`, 'INFO', 'powerpilot_entity_info');
        setTimeout(() => {
          try { xrm.Page.ui.clearFormNotification('powerpilot_entity_info'); } catch (_) {}
        }, 5000);
      }
    } catch (_) {}

    return {
      hasXrm: !!xrm,
      found: !!logicalName || !!schemaName,
      schemaName: schemaName || logicalName,
      logicalName: logicalName || (schemaName ? schemaName.toLowerCase() : ''),
      displayName: displayName || schemaName || logicalName,
      objectTypeCode,
      primaryIdAttribute: primaryIdAttribute || (logicalName ? `${logicalName}id` : ''),
      primaryNameAttribute: primaryNameAttribute || '',
      isCustomEntity
    };
  } catch (err) {
    return {
      hasXrm: false,
      found: false,
      error: err?.message || String(err)
    };
  }
}

function getRecordIdFromForm() {
  try {
    function getXrmRoot() {
      const candidates = [window, window.top, window.parent].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (candidate && candidate.Xrm) {
            return candidate.Xrm;
          }
        } catch (e) {
          // Ignore cross-origin exceptions
        }
      }
      return null;
    }

    const xrm = getXrmRoot();
    const formContext = xrm && xrm.Page && xrm.Page.data ? xrm.Page.data.entity : null;

    let rawId = '';
    try {
      if (formContext && typeof formContext.getId === 'function') {
        rawId = formContext.getId();
      }
      if (!rawId && xrm?.Utility?.getPageContext?.()?.input?.entityId) {
        rawId = xrm.Utility.getPageContext().input.entityId;
      }
    } catch (_) {}

    let entityName = '';
    try {
      if (formContext && typeof formContext.getEntityName === 'function') {
        entityName = formContext.getEntityName();
      }
      if (!entityName && xrm?.Utility?.getPageContext?.()?.input?.entityName) {
        entityName = xrm.Utility.getPageContext().input.entityName;
      }
    } catch (_) {}

    let recordName = '';
    try {
      if (formContext && typeof formContext.getPrimaryAttributeValue === 'function') {
        recordName = formContext.getPrimaryAttributeValue();
      }
    } catch (_) {}

    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (!rawId) {
        rawId = urlParams.get('id') || '';
      }
      if (!entityName) {
        entityName = urlParams.get('etn') || urlParams.get('entityname') || urlParams.get('entity') || '';
      }
    } catch (_) {}

    const cleanId = rawId ? rawId.replace(/[{}]/g, '').toLowerCase() : '';
    const formattedId = cleanId ? `{${cleanId.toUpperCase()}}` : '';

    let isNewRecord = false;
    try {
      if (xrm?.Page?.ui?.getFormType) {
        isNewRecord = xrm.Page.ui.getFormType() === 1;
      }
    } catch (_) {}

    try {
      if (xrm?.Page?.ui?.setFormNotification) {
        const notifText = cleanId
          ? `[Power Pilot] Record ID: ${cleanId}`
          : (isNewRecord ? '[Power Pilot] New record - not saved yet (no ID)' : '[Power Pilot] No Record ID found');
        xrm.Page.ui.setFormNotification(notifText, 'INFO', 'powerpilot_record_id');
        setTimeout(() => {
          try { xrm.Page.ui.clearFormNotification('powerpilot_record_id'); } catch (_) {}
        }, 5000);
      }
    } catch (_) {}

    return {
      hasXrm: !!xrm,
      found: !!cleanId,
      rawId,
      cleanId,
      formattedId,
      entityName,
      recordName,
      isNewRecord,
      url: window.location.href
    };
  } catch (err) {
    return {
      hasXrm: false,
      found: false,
      error: err?.message || String(err)
    };
  }
}

async function collectEntityDefinitionMetadata() {
  try {
    function getXrmRoot() {
      const candidates = [window, window.top, window.parent].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (candidate && candidate.Xrm) {
            return candidate.Xrm;
          }
        } catch (e) {}
      }
      return null;
    }

    const xrm = getXrmRoot();
    const formContext = xrm && xrm.Page && xrm.Page.data ? xrm.Page.data.entity : null;

    let entityName = '';
    try {
      const urlParams = new URLSearchParams(window.location.search);
      entityName =
        urlParams.get('etn') ||
        urlParams.get('entityname') ||
        urlParams.get('entity') ||
        (formContext && typeof formContext.getEntityName === 'function' ? formContext.getEntityName() : '') ||
        '';
    } catch (_error) {
      entityName = formContext && typeof formContext.getEntityName === 'function'
        ? formContext.getEntityName()
        : '';
    }

    if (!xrm || !entityName) {
      return {
        entityName,
        hasXrm: !!xrm,
        properties: [],
        errors: []
      };
    }

    function getApiVersionCandidates(xrmRoot) {
      const candidates = [];
      const globalContext = xrmRoot && xrmRoot.Utility && typeof xrmRoot.Utility.getGlobalContext === 'function'
        ? xrmRoot.Utility.getGlobalContext()
        : null;
      const rawVersion = globalContext && typeof globalContext.getVersion === 'function'
        ? globalContext.getVersion()
        : null;
      const normalizedVersion = rawVersion
        ? `v${String(rawVersion).split('.').slice(0, 2).join('.')}`
        : null;

      if (normalizedVersion) {
        candidates.push(normalizedVersion);
      }

      ['v9.2', 'v9.1', 'v9.0', 'v8.2', 'v8.1'].forEach((version) => {
        if (!candidates.includes(version)) {
          candidates.push(version);
        }
      });

      return candidates;
    }

    let entityDef = null;
    if (xrm.Utility && typeof xrm.Utility.getGlobalContext === 'function') {
      const clientUrl = xrm.Utility.getGlobalContext().getClientUrl();
      const apiVersions = getApiVersionCandidates(xrm);
      for (const apiVersion of apiVersions) {
        try {
          const url = `${clientUrl}/api/data/${apiVersion}/EntityDefinitions(LogicalName='${entityName}')?$select=LogicalName,SchemaName,DisplayName,Description,ObjectTypeCode,PrimaryIdAttribute,PrimaryNameAttribute,EntitySetName,OwnershipType,IsCustomEntity,IsActivity,CreatedOn,ModifiedOn`;
          const res = await fetch(url, {
            headers: { Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
            credentials: 'include'
          });
          if (res.ok) {
            entityDef = await res.json();
            break;
          }
        } catch (_) {}
      }
    }

    if (!entityDef && xrm.Utility && typeof xrm.Utility.getEntityMetadata === 'function') {
      try {
        entityDef = await xrm.Utility.getEntityMetadata(entityName);
      } catch (_) {}
    }

    function getLocalizedLabel(labelNode) {
      if (!labelNode) return '';
      if (typeof labelNode === 'string') return labelNode;
      if (labelNode.UserLocalizedLabel && labelNode.UserLocalizedLabel.Label) return labelNode.UserLocalizedLabel.Label;
      if (Array.isArray(labelNode.LocalizedLabels) && labelNode.LocalizedLabels.length > 0) {
        return labelNode.LocalizedLabels[0]?.Label || '';
      }
      return '';
    }

    const displayName = getLocalizedLabel(entityDef?.DisplayName) || entityName;
    const description = getLocalizedLabel(entityDef?.Description) || '-';
    const schemaName = entityDef?.SchemaName || entityName;
    const logicalName = entityDef?.LogicalName || entityName.toLowerCase();
    const objectTypeCode = entityDef?.ObjectTypeCode !== undefined ? entityDef.ObjectTypeCode : '-';
    const primaryIdAttribute = entityDef?.PrimaryIdAttribute || (logicalName ? `${logicalName}id` : '-');
    const primaryNameAttribute = entityDef?.PrimaryNameAttribute || '-';
    const entitySetName = entityDef?.EntitySetName || '-';
    const ownershipType = entityDef?.OwnershipType || '-';
    const isCustomEntity = entityDef?.IsCustomEntity !== undefined ? (entityDef.IsCustomEntity ? 'Yes' : 'No') : '-';
    const isActivity = entityDef?.IsActivity !== undefined ? (entityDef.IsActivity ? 'Yes' : 'No') : '-';
    const createdOn = entityDef?.CreatedOn ? new Date(entityDef.CreatedOn).toLocaleString() : '-';
    const modifiedOn = entityDef?.ModifiedOn ? new Date(entityDef.ModifiedOn).toLocaleString() : '-';

    const properties = [
      { 'Property': 'Schema Name', 'Value': schemaName },
      { 'Property': 'Logical Name', 'Value': logicalName },
      { 'Property': 'Display Name', 'Value': displayName },
      { 'Property': 'Description', 'Value': description },
      { 'Property': 'Object Type Code (ETC)', 'Value': String(objectTypeCode) },
      { 'Property': 'Primary ID Attribute', 'Value': primaryIdAttribute },
      { 'Property': 'Primary Name Attribute', 'Value': primaryNameAttribute },
      { 'Property': 'Entity Set Name', 'Value': entitySetName },
      { 'Property': 'Ownership Type', 'Value': String(ownershipType) },
      { 'Property': 'Is Custom Entity', 'Value': isCustomEntity },
      { 'Property': 'Is Activity', 'Value': isActivity },
      { 'Property': 'Created On', 'Value': createdOn },
      { 'Property': 'Modified On', 'Value': modifiedOn }
    ];

    return {
      entityName: schemaName || entityName,
      hasXrm: true,
      properties,
      errors: []
    };
  } catch (error) {
    return {
      entityName: '',
      hasXrm: false,
      properties: [],
      errors: ['Failed to collect entity definition: ' + (error?.message || String(error))]
    };
  }
}

async function showUserSecurityRoles() {
  state.currentView = 'securityRoles';
  updateModeButtons();
  updateSearchPlaceholder();
  updateCopyAllButtonState();
  if (rolesModal) rolesModal.hidden = true; // Separate popup modal disabled for time being

  setStatus('Retrieving current user security roles...');
  errorsElement.innerHTML = '';
  setActionButtonsDisabled(true);

  try {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      const mockRoles = [
        { id: '11111111-2222-3333-4444-555555555555', name: 'System Administrator' },
        { id: '22222222-3333-4444-5555-666666666666', name: 'System Customizer' },
        { id: '33333333-4444-5555-6666-777777777777', name: 'Power Pilot Developer' },
        { id: '44444444-5555-6666-7777-888888888888', name: 'Basic User' }
      ];
      state.userRoles = mockRoles;
      state.rolesUserInfo = { userName: 'Current User (Dev Preview)', userId: '00000000-0000-0000-0000-000000000001' };
      render();
      updateCopyAllButtonState();
      setStatus('User Security Roles: <strong class="status-highlight">4 security roles found</strong>', mockRoles.map((r) => r.name).join(', '));
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Could not find the active tab.');
    }

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: 'MAIN',
      func: getUserSecurityRolesInPage
    });

    const responses = frameResults.map((frame) => frame.result).filter(Boolean);
    const validResponse = responses.find((res) => res.roles && res.roles.length > 0) ||
      responses.find((res) => res.hasXrm) ||
      responses[0];

    if (!validResponse) {
      throw new Error('No response from any frame. Make sure you are on a Dynamics 365 or Power Apps page.');
    }

    if (!validResponse.hasXrm) {
      setStatus('Xrm is not available. Please open a Dynamics 365 or Power Apps page.');
      return;
    }

    const roles = validResponse.roles || [];
    const userName = validResponse.userName || 'Current User';
    const userId = validResponse.userId || '';

    state.userRoles = roles;
    state.rolesUserInfo = { userName, userId };

    render();
    updateCopyAllButtonState();

    if (roles.length > 0) {
      const summaryText = `${roles.length} security role${roles.length === 1 ? '' : 's'}`;
      const roleNamesText = roles.map((r) => r.name).join(', ');
      setStatus(`User Security Roles (${escapeHtml(userName)}): <strong class="status-highlight">${summaryText}</strong>`, roleNamesText);
    } else {
      setStatus(`No security roles found for ${escapeHtml(userName)}.`);
    }
  } catch (error) {
    const message = error?.message || String(error);
    renderErrors([message]);
    setStatus('Unable to get user security roles: ' + message);
  } finally {
    setActionButtonsDisabled(false);
  }
}

function renderSecurityRolesView() {
  const roles = state.userRoles || [];
  const userInfo = state.rolesUserInfo || {};
  const userName = userInfo.userName || 'Current User';
  const userId = userInfo.userId || '';

  if (roles.length === 0) {
    resultsElement.innerHTML = `
      <div class="empty-state">
        <p style="margin: 0 0 6px; font-weight: 700; color: #1a3b8b;">No Security Roles Loaded</p>
        <span style="font-size: 11px; color: #64779b;">Click USER SECURITY ROLES to load current user roles.</span>
      </div>
    `;
    return;
  }

  const query = state.searchText;
  const filtered = query
    ? roles.filter((r) => (r.name && r.name.toLowerCase().includes(query)) || (r.id && r.id.toLowerCase().includes(query)))
    : roles;

  const rolesHtml = filtered.length > 0
    ? filtered.map((role) => {
        const roleName = role.name || 'Unnamed Role';
        const roleId = role.id ? role.id.replace(/[{}]/g, '').toLowerCase() : '';
        return `
          <div class="detail-row" style="padding: 7px 10px; margin-bottom: 4px; background: #f8fbff; border: 1px solid #e2ecf9; border-radius: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div style="min-width: 0; flex: 1;">
                <div style="font-size: 12px; font-weight: 600; color: #172b53; word-break: break-word;">${escapeHtml(roleName)}</div>
                ${roleId ? `<div style="font-size: 9.5px; color: #697d9e; font-family: Consolas, monospace;">${escapeHtml(roleId)}</div>` : ''}
              </div>
              <button type="button" class="copyable-text" data-copy-text="${escapeHtml(roleName)}" data-copy-message="Copied ${escapeHtml(roleName)}!" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 10px; border-radius: 6px; background: #ffffff; color: #2546a1; cursor: pointer; border: 1px solid #c8daf2; font-family: inherit; font-weight: 600; flex-shrink: 0;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>Copy</span>
              </button>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-state" style="padding: 12px 10px;">No matching security roles.</div>';

  resultsElement.innerHTML = `
    <div class="inspector-layout">
      <section class="section-card">
        <div class="section-heading-row">
          <h2 class="section-title">Security Roles</h2>
          <span class="section-badge">${filtered.length} / ${roles.length} Roles</span>
        </div>
        <div class="plugin-detail">
          <div class="plugin-detail-header" style="margin-bottom: 10px;">
            <div class="plugin-detail-heading">
              <h3 class="plugin-detail-title" style="font-size: 13px;">${escapeHtml(userName)}</h3>
              <p class="plugin-detail-subtitle">${userId ? `ID: ${escapeHtml(userId)}` : 'Logged-in Dataverse User'}</p>
            </div>
            <div class="plugin-detail-actions" style="display: flex; gap: 6px;">
              <button type="button" class="btn" id="rolesViewExportBtn" style="min-height: 28px; padding: 4px 10px; font-size: 11px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>Export Excel</span>
              </button>
            </div>
          </div>
          <div class="roles-embedded-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 340px; overflow-y: auto;">
            ${rolesHtml}
          </div>
        </div>
      </section>
    </div>
  `;

  const exportBtn = resultsElement.querySelector('#rolesViewExportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportRolesToExcel);
  }
}

function openRolesModal(userName, userId, roles) {
  if (!rolesModal) return;
  if (rolesModalUserSubtitle) {
    const cleanId = userId ? userId.replace(/[{}]/g, '').toLowerCase() : '';
    rolesModalUserSubtitle.textContent = userName ? `${userName}${cleanId ? ` • ${cleanId}` : ''}` : 'Current User';
    rolesModalUserSubtitle.title = cleanId ? `${userName} (${cleanId})` : userName || '';
  }
  renderRolesList();
  rolesModal.hidden = false;
  if (rolesSearchInput) {
    setTimeout(() => rolesSearchInput.focus(), 80);
  }
}

function closeRolesModal() {
  if (rolesModal) {
    rolesModal.hidden = true;
  }
}

function renderRolesList() {
  if (!rolesList) return;
  const roles = state.userRoles || [];
  const query = (state.rolesSearchText || '').trim().toLowerCase();
  const filtered = query
    ? roles.filter((r) => (r.name && r.name.toLowerCase().includes(query)) || (r.id && r.id.toLowerCase().includes(query)))
    : roles;

  if (rolesModalCountBadge) {
    rolesModalCountBadge.textContent = `${filtered.length} / ${roles.length} Role${roles.length === 1 ? '' : 's'}`;
  }

  if (filtered.length === 0) {
    rolesList.innerHTML = `<div class="empty-state" style="padding: 16px 10px;">${roles.length === 0 ? 'No security roles found for this user.' : 'No roles matching "' + escapeHtml(state.rolesSearchText) + '"'}</div>`;
    return;
  }

  rolesList.innerHTML = filtered.map((role) => {
    const roleName = role.name || 'Unnamed Role';
    const roleId = role.id ? role.id.replace(/[{}]/g, '').toLowerCase() : '';
    return `
      <div class="role-card-item">
        <div class="role-item-info">
          <div class="role-item-name" title="${escapeHtml(roleName)}">${escapeHtml(roleName)}</div>
          ${roleId ? `<div class="role-item-id" title="${escapeHtml(roleId)}">${escapeHtml(roleId)}</div>` : ''}
        </div>
        <button type="button" class="role-item-copy-btn" data-role-copy="${escapeHtml(roleName)}" title="Copy role name">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Copy</span>
        </button>
      </div>
    `;
  }).join('');

  rolesList.querySelectorAll('[data-role-copy]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const textToCopy = btn.getAttribute('data-role-copy') || '';
      if (!textToCopy) return;
      await writeClipboard(textToCopy);
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Copied!</span>
      `;
      btn.style.background = '#dcfce7';
      btn.style.color = '#15803d';
      btn.style.borderColor = '#86efac';
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }, 1500);
    });
  });
}

async function copyAllRolesToClipboard() {
  const roles = state.userRoles || [];
  if (roles.length === 0) {
    setStatus('No security roles to copy.');
    return;
  }
  const text = roles.map((r) => r.name).join('\n');
  await writeClipboard(text);
  setStatus(`Copied ${roles.length} role name(s) to clipboard!`, text);
  flashStatusCopied();
  if (copyAllRolesButton) {
    const origHtml = copyAllRolesButton.innerHTML;
    copyAllRolesButton.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <span>Copied All!</span>
    `;
    setTimeout(() => {
      copyAllRolesButton.innerHTML = origHtml;
    }, 1500);
  }
}

function exportRolesToExcel() {
  const roles = state.userRoles || [];
  if (roles.length === 0) {
    setStatus('No security roles to export.');
    return;
  }
  const userName = state.rolesUserInfo?.userName || 'Current_User';
  const userId = state.rolesUserInfo?.userId || '';

  const rows = roles.map((role) => ({
    'Role Name': role.name || '',
    'Role ID': role.id ? role.id.replace(/[{}]/g, '').toLowerCase() : '',
    'User Name': userName,
    'User ID': userId ? userId.replace(/[{}]/g, '').toLowerCase() : ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Security Roles');

  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const safeUserName = userName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeUserName}_Security_Roles_${timestamp}.xlsx`;

  XLSX.writeFile(workbook, filename);
  setStatus(`Exported ${roles.length} security roles for ${userName} to Excel.`);
}

async function getUserSecurityRolesInPage() {
  try {
    function getXrmRoot() {
      const candidates = [window, window.top, window.parent].filter(Boolean);
      for (const candidate of candidates) {
        try {
          if (candidate && candidate.Xrm) {
            return candidate.Xrm;
          }
        } catch (e) {
          // Ignore cross-origin exceptions
        }
      }
      return null;
    }

    function safeEscapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function showFloatingRolesDialogInPage(doc, userName, userId, roles) {
      if (!doc || !doc.body) return;
      const existing = doc.getElementById('powerpilot-floating-roles-dialog');
      if (existing) {
        existing.remove();
      }

      if (!doc.getElementById('powerpilot-floating-roles-styles')) {
        const style = doc.createElement('style');
        style.id = 'powerpilot-floating-roles-styles';
        style.textContent = `
          @keyframes ppRolesFloatFadeIn {
            from { opacity: 0; transform: translateY(-8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          #powerpilot-floating-roles-dialog * { box-sizing: border-box; }
          .pp-role-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: #f8fbff; border: 1px solid #e1edfc; border-radius: 8px; gap: 8px; margin-bottom: 6px; }
          .pp-role-row:hover { background: #edf4fe; border-color: #bcd5f7; }
          .pp-role-name { font-size: 12px; font-weight: 600; color: #172b53; word-break: break-word; }
          .pp-role-id { font-size: 9.5px; color: #697d9e; font-family: Consolas, monospace; }
          .pp-role-copy-btn { padding: 3px 8px; font-size: 10px; border-radius: 6px; background: #ffffff; color: #2546a1; border: 1px solid #c8daf2; cursor: pointer; font-weight: 600; flex-shrink: 0; transition: 0.15s; }
          .pp-role-copy-btn:hover { background: #2546a1; color: #ffffff; }
          .pp-header-btn { width: 24px; height: 24px; border-radius: 50%; border: none; background: #ebf2fc; color: #1e3a8a; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
          .pp-header-btn:hover { background: #d7e4fa; }
        `;
        doc.head.appendChild(style);
      }

      const dialog = doc.createElement('div');
      dialog.id = 'powerpilot-floating-roles-dialog';
      dialog.style.cssText = 'position: fixed; top: 75px; right: 28px; width: 370px; max-height: 520px; z-index: 9999999; background: #ffffff; border-radius: 16px; border: 1px solid #cce0ff; box-shadow: 0 16px 40px rgba(12, 24, 60, 0.22); display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #17253f; overflow: hidden; animation: ppRolesFloatFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);';

      const roleCount = roles.length;
      dialog.innerHTML = `
        <div id="pp-roles-header" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: linear-gradient(135deg, #eef4ff 0%, #dce9fc 100%); border-bottom: 1px solid #d0e0f8; cursor: move; user-select: none;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 26px; height: 26px; border-radius: 8px; background: #2546a1; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px;">🛡️</div>
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #172b53;">Security Roles</div>
              <div style="font-size: 10.5px; color: #5c6f93; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${safeEscapeHtml(userName)}">${safeEscapeHtml(userName || 'Current User')}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: #cde0fc; color: #1e3a8a;">${roleCount} Roles</span>
            <button id="pp-roles-close" class="pp-header-btn" title="Close">✕</button>
          </div>
        </div>
        <div style="padding: 8px 12px; background: #fbfdff; border-bottom: 1px solid #eaf0fb;">
          <input id="pp-roles-search" type="text" placeholder="Search security roles..." style="width: 100%; padding: 6px 12px; border-radius: 999px; border: 1px solid #cbdcf2; font-size: 11.5px; outline: none;" />
        </div>
        <div id="pp-roles-list" style="flex: 1 1 auto; max-height: 320px; overflow-y: auto; padding: 10px 12px;">
          ${roles.map((r) => `
            <div class="pp-role-row" data-role-name="${safeEscapeHtml(r.name).toLowerCase()}" data-role-id="${safeEscapeHtml(r.id || '').toLowerCase()}">
              <div style="min-width: 0; flex: 1;">
                <div class="pp-role-name">${safeEscapeHtml(r.name)}</div>
                ${r.id ? `<div class="pp-role-id">${safeEscapeHtml(r.id)}</div>` : ''}
              </div>
              <button type="button" class="pp-role-copy-btn" data-copy-val="${safeEscapeHtml(r.name)}">Copy</button>
            </div>
          `).join('')}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f5f9ff; border-top: 1px solid #dbe7f8;">
          <button id="pp-roles-copy-all" style="padding: 6px 12px; border-radius: 999px; background: #2546a1; color: #fff; border: none; font-size: 11px; font-weight: 600; cursor: pointer;">Copy All Roles</button>
          <button id="pp-roles-dismiss" style="padding: 6px 12px; border-radius: 999px; background: #e5edf9; color: #203560; border: none; font-size: 11px; font-weight: 600; cursor: pointer;">Close</button>
        </div>
      `;

      doc.body.appendChild(dialog);

      const close = () => dialog.remove();
      const closeBtn = dialog.querySelector('#pp-roles-close');
      if (closeBtn) closeBtn.onclick = close;
      const dismissBtn = dialog.querySelector('#pp-roles-dismiss');
      if (dismissBtn) dismissBtn.onclick = close;

      const searchInput = dialog.querySelector('#pp-roles-search');
      if (searchInput) {
        searchInput.oninput = (e) => {
          const q = (e.target.value || '').trim().toLowerCase();
          const rows = dialog.querySelectorAll('.pp-role-row');
          rows.forEach((row) => {
            const name = row.getAttribute('data-role-name') || '';
            const id = row.getAttribute('data-role-id') || '';
            row.style.display = (!q || name.includes(q) || id.includes(q)) ? 'flex' : 'none';
          });
        };
      }

      dialog.querySelectorAll('.pp-role-copy-btn').forEach((btn) => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const text = btn.getAttribute('data-copy-val') || '';
          if (!text) return;
          try {
            await navigator.clipboard.writeText(text);
          } catch (_) {
            const ta = doc.createElement('textarea');
            ta.value = text;
            doc.body.appendChild(ta);
            ta.select();
            doc.execCommand('copy');
            ta.remove();
          }
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          btn.style.background = '#dcfce7';
          btn.style.color = '#15803d';
          setTimeout(() => {
            btn.textContent = orig;
            btn.style.background = '';
            btn.style.color = '';
          }, 1500);
        };
      });

      const copyAllBtn = dialog.querySelector('#pp-roles-copy-all');
      if (copyAllBtn) {
        copyAllBtn.onclick = async () => {
          const allText = roles.map((r) => r.name).join('\n');
          try {
            await navigator.clipboard.writeText(allText);
          } catch (_) {
            const ta = doc.createElement('textarea');
            ta.value = allText;
            doc.body.appendChild(ta);
            ta.select();
            doc.execCommand('copy');
            ta.remove();
          }
          const orig = copyAllBtn.textContent;
          copyAllBtn.textContent = 'Copied All!';
          setTimeout(() => {
            copyAllBtn.textContent = orig;
          }, 1500);
        };
      }

      const header = dialog.querySelector('#pp-roles-header');
      if (header) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialLeft = 0;
        let initialTop = 0;

        header.onmousedown = (e) => {
          if (e.target.tagName === 'BUTTON') return;
          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;
          const rect = dialog.getBoundingClientRect();
          initialLeft = rect.left;
          initialTop = rect.top;
          dialog.style.left = `${initialLeft}px`;
          dialog.style.top = `${initialTop}px`;
          dialog.style.right = 'auto';

          const onMouseMove = (moveEvent) => {
            if (!isDragging) return;
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            dialog.style.left = `${Math.max(10, Math.min(window.innerWidth - dialog.offsetWidth - 10, initialLeft + dx))}px`;
            dialog.style.top = `${Math.max(10, Math.min(window.innerHeight - dialog.offsetHeight - 10, initialTop + dy))}px`;
          };

          const onMouseUp = () => {
            isDragging = false;
            doc.removeEventListener('mousemove', onMouseMove);
            doc.removeEventListener('mouseup', onMouseUp);
          };

          doc.addEventListener('mousemove', onMouseMove);
          doc.addEventListener('mouseup', onMouseUp);
        };
      }
    }

    const xrm = getXrmRoot();
    if (!xrm || !xrm.Utility || typeof xrm.Utility.getGlobalContext !== 'function') {
      return {
        hasXrm: false,
        userName: '',
        userId: '',
        roles: [],
        error: 'Xrm is not available.'
      };
    }

    const globalContext = xrm.Utility.getGlobalContext();
    const userSettings = globalContext.userSettings || {};
    const userName = userSettings.userName || '';
    const rawUserId = userSettings.userId || '';
    const userId = rawUserId ? rawUserId.replace(/[{}]/g, '').toLowerCase() : '';

    let roles = [];

    // 1. Try userSettings.roles
    if (userSettings.roles) {
      try {
        if (typeof userSettings.roles.forEach === 'function') {
          userSettings.roles.forEach((r) => {
            if (r && (r.name || r.id)) {
              roles.push({ id: (r.id || r.roleid || '').replace(/[{}]/g, '').toLowerCase(), name: r.name || 'Role' });
            }
          });
        } else if (typeof userSettings.roles.getLength === 'function') {
          for (let i = 0; i < userSettings.roles.getLength(); i++) {
            const r = userSettings.roles.get(i);
            if (r && (r.name || r.id)) {
              roles.push({ id: (r.id || r.roleid || '').replace(/[{}]/g, '').toLowerCase(), name: r.name || 'Role' });
            }
          }
        } else if (Array.isArray(userSettings.roles)) {
          userSettings.roles.forEach((r) => {
            if (r && (r.name || r.id)) {
              roles.push({ id: (r.id || r.roleid || '').replace(/[{}]/g, '').toLowerCase(), name: r.name || 'Role' });
            }
          });
        }
      } catch (_) {}
    }

    // 2. Try userSettings.securityRoleNames fallback
    if (roles.length === 0 && Array.isArray(userSettings.securityRoleNames) && userSettings.securityRoleNames.length > 0) {
      const ids = Array.isArray(userSettings.securityRoles) ? userSettings.securityRoles : [];
      roles = userSettings.securityRoleNames.map((name, i) => ({
        name,
        id: (ids[i] || '').replace(/[{}]/g, '').toLowerCase()
      }));
    }

    // 3. Web API fallback
    if (roles.length === 0 && userId) {
      try {
        const clientUrl = globalContext.getClientUrl();
        const res = await fetch(`${clientUrl}/api/data/v9.2/systemusers(${userId})/systemuserroles_association?$select=roleid,name`, {
          headers: { Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
          credentials: 'include'
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.value)) {
            roles = json.value.map((r) => ({
              id: (r.roleid || '').replace(/[{}]/g, '').toLowerCase(),
              name: r.name || 'Role'
            }));
          }
        }
      } catch (_) {}
    }

    // Deduplicate and sort roles alphabetically
    const roleMap = new Map();
    roles.forEach((r) => {
      const key = (r.name || '').trim().toLowerCase();
      if (key && !roleMap.has(key)) {
        roleMap.set(key, { name: r.name.trim(), id: r.id || '' });
      }
    });
    const uniqueRoles = Array.from(roleMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    // Separate in-page popup disabled for time being; remove any existing one
    try {
      const doc = window.top.document || document;
      const existing = doc.getElementById('powerpilot-floating-roles-dialog');
      if (existing) {
        existing.remove();
      }
    } catch (_) {}

    return {
      hasXrm: true,
      userName,
      userId,
      roles: uniqueRoles
    };
  } catch (error) {
    return {
      hasXrm: false,
      userName: '',
      userId: '',
      roles: [],
      error: error?.message || String(error)
    };
  }
}

if (typeof window !== 'undefined') {
  window.__powerPilot__ = {
    openRolesModal,
    closeRolesModal,
    renderRolesList,
    state
  };
}



