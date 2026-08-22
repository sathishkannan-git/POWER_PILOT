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
const searchInput = document.getElementById('searchInput');
const closeButton = document.getElementById('closeButton');

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
  showOobPlugins: false
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
copyAllButton.addEventListener('click', () => copyAllTables());
toggleOobPluginsButton.addEventListener('click', toggleShowOobPlugins);
enableLockedFieldsButton.addEventListener('click', toggleEnableFieldsOnPage);
toggleHiddenFieldsButton.addEventListener('click', toggleHiddenFieldsOnPage);
makeRequiredOptionalButton.addEventListener('click', toggleMandatoryFieldsOnPage);
toggleSchemaNamesButton.addEventListener('click', toggleSchemaNamesOnPage);
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

function setActionButtonsDisabled(isDisabled) {
  refreshButton.disabled = isDisabled;
  pluginExplorerButton.disabled = isDisabled;
  enableLockedFieldsButton.disabled = isDisabled;
  toggleHiddenFieldsButton.disabled = isDisabled;
  makeRequiredOptionalButton.disabled = isDisabled;
  toggleSchemaNamesButton.disabled = isDisabled;
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
}

function updateShowOobPluginsButton() {
  const span = toggleOobPluginsButton.querySelector('span');
  if (span) span.innerHTML = (state.showOobPlugins ? 'Hide OOB Plugins' : 'Show OOB Plugins') + ' <span class="badge-new">new</span>';
  toggleOobPluginsButton.setAttribute('aria-pressed', state.showOobPlugins ? 'true' : 'false');
}

function updateSearchPlaceholder() {
  const placeholder = state.currentView === 'plugins'
    ? 'Search by plugin, assembly, step, entity, or message'
    : 'Search by name or columns';
  searchInput.placeholder = placeholder;
  searchInput.setAttribute('aria-label', placeholder);
}

function updateCopyAllButtonState() {
  const canCopyAll = canUseCopyAll();
  const isOptionSetView = state.currentView === 'optionSets';
  copyAllButton.hidden = !isOptionSetView || !canCopyAll;
  copyAllButton.disabled = !isOptionSetView || !canCopyAll;

  const isPluginView = state.currentView === 'plugins';
  toggleOobPluginsButton.hidden = !isPluginView;
  toggleOobPluginsButton.disabled = !isPluginView;
}

function canUseCopyAll() {
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

async function writeClipboard(text, successMessage) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
    setStatus(successMessage);
  } catch (error) {
    fallbackCopy(text);
    setStatus(successMessage);
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

function setStatus(message) {
  statusElement.textContent = message;
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
