// Dynamics 365 Level Up Extension - Content Script
console.log('[D365-Ext] Content script active on page:', window.location.href);

function collectOptionSetValues() {
  return (async () => {
    try {
      console.log('[D365-Ext] Starting option-set collection from the current form');

      const results = [];
      const seenNames = new Set();
      let extractedEntityName = null;
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

      function isOptionSetAttribute(attribute) {
        if (!attribute || typeof attribute.getAttributeType !== 'function') {
          return false;
        }

        const attributeType = String(attribute.getAttributeType()).toLowerCase();
        return ['picklist', 'state', 'status', 'multiselectpicklist'].includes(attributeType);
      }

      function buildOptionList(attribute, selectedValue) {
        if (typeof attribute.getOptions !== 'function') {
          return [];
        }

        const options = attribute.getOptions() || [];
        return options.map((option) => {
          const value = option?.value;
          const text = option?.text || option?.label || `Option ${value}`;
          const isSelected = Array.isArray(selectedValue)
            ? selectedValue.includes(value)
            : selectedValue === value;

          return {
            value,
            text,
            isSelected
          };
        });
      }

      function getOptionLabelsForCurrentValue(options, currentValue) {
        if (!Array.isArray(options) || options.length === 0) {
          return null;
        }

        if (Array.isArray(currentValue)) {
          return options
            .filter((option) => currentValue.includes(option.value))
            .map((option) => option.text);
        }

        const selectedOption = options.find((option) => option.value === currentValue);
        return selectedOption ? selectedOption.text : null;
      }

      function resolveFieldLabel(attribute, xrmRoot, name) {
        const attributeLabel = attribute?.getLabel?.();
        if (attributeLabel) {
          return attributeLabel;
        }

        const controlLabel = xrmRoot?.Page?.getControl?.(name)?.getLabel?.();
        return controlLabel || name;
      }

      function getLocalizedLabel(labelNode) {
        if (!labelNode) {
          return null;
        }

        if (labelNode.UserLocalizedLabel?.Label) {
          return labelNode.UserLocalizedLabel.Label;
        }

        const localizedLabels = labelNode.LocalizedLabels;
        if (Array.isArray(localizedLabels) && localizedLabels.length > 0) {
          return localizedLabels[0]?.Label || null;
        }

        return null;
      }

      function getApiVersionCandidates(xrmRoot) {
        const candidates = [];
        const rawVersion = xrmRoot?.Utility?.getGlobalContext?.().getVersion?.();
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
                  'Accept': 'application/json',
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
        const name = attribute?.getName?.();
        if (!name || seenNames.has(name.toLowerCase())) {
          return;
        }

        try {
          const label = resolveFieldLabel(attribute, xrmRoot, name);
          const currentValue = attribute?.getValue?.();
          const options = buildOptionList(attribute, currentValue);
          const currentLabel = getOptionLabelsForCurrentValue(options, currentValue);

          if (options.length > 0) {
            currentValueMap[name] = currentValue;
            results.push({
              name,
              label,
              type: String(attribute.getAttributeType?.() || 'picklist'),
              currentValue,
              currentLabel,
              options,
              source: 'Form Attributes'
            });
            seenNames.add(name.toLowerCase());
            console.log('[D365-Ext] Added form attribute:', name, 'options:', options.length);
          }
        } catch (fieldError) {
          console.log('[D365-Ext] Could not read form attribute:', name, fieldError.message);
        }
      }

      const xrm = getXrmRoot();
      const formContext = xrm?.Page?.data?.entity;

      try {
        const urlParams = new URLSearchParams(window.location.search);
        extractedEntityName = urlParams.get('etn') ||
          urlParams.get('entityname') ||
          urlParams.get('etc') ||
          urlParams.get('entity') ||
          formContext?.getEntityName?.();
      } catch (urlError) {
        console.log('[D365-Ext] Could not read entity name from URL:', urlError.message);
      }

      if (formContext?.attributes?.get) {
        console.log('[D365-Ext] Reading option sets from form attributes');
        const attributes = formContext.attributes.get() || [];
        attributes.forEach((attribute) => {
          if (isOptionSetAttribute(attribute)) {
            addFormField(attribute, xrm);
          }
        });
      }

      if (results.length > 0) {
        console.log('[D365-Ext] Found', results.length, 'option-set fields directly from the form');
        return {
          url: location.href,
          entityName: extractedEntityName,
          hasXrm: !!xrm,
          optionSets: results,
          errors: [],
          diagnostics: {
            method: 'FORM_ATTRIBUTES',
            entityName: extractedEntityName,
            found: results.length,
            currentValuesAvailable: Object.keys(currentValueMap).length,
            retrievalMethods: ['Form Attributes']
          }
        };
      }

      if (extractedEntityName && xrm?.Utility?.getGlobalContext) {
        console.log('[D365-Ext] Form attributes did not expose option sets; trying Web API metadata');
        try {
          const clientUrl = xrm.Utility.getGlobalContext().getClientUrl();
          const metadata = await fetchMetadataWithVersionFallback(clientUrl, extractedEntityName, xrm);
          (metadata.value || []).forEach((attr) => {
            const attributeType = String(attr.AttributeType || '').toLowerCase();
            const isOptionSet = ['picklist', 'state', 'status', 'multiselectpicklist'].includes(attributeType);
            if (!isOptionSet || !attr.LogicalName) {
              return;
            }

            const name = attr.LogicalName;
            if (seenNames.has(name.toLowerCase())) {
              return;
            }

            const optionSet = attr.OptionSet || attr.GlobalOptionSet;
            const options = (optionSet?.Options || []).map((option) => ({
              value: option.Value,
              text: getLocalizedLabel(option.Label) || `Option ${option.Value}`,
              isSelected: false
            }));

            if (options.length > 0) {
              results.push({
                name,
                label: getLocalizedLabel(attr.DisplayName) || name,
                type: attr.AttributeType,
                currentValue: currentValueMap[name] !== undefined ? currentValueMap[name] : null,
                currentLabel: null,
                options,
                source: 'Web API'
              });
              seenNames.add(name.toLowerCase());
            }
          });
        } catch (metadataError) {
          console.log('[D365-Ext] Web API metadata fallback failed:', metadataError.message);
        }
      }

      console.log('[D365-Ext] Final collection complete:', results.length, 'option set fields retrieved');

      return {
        url: location.href,
        entityName: extractedEntityName,
        hasXrm: !!xrm,
        optionSets: results,
        errors: results.length === 0 ? ['No option set fields found for this entity or form'] : [],
        diagnostics: {
          method: results.some((result) => result.source === 'Web API') ? 'FORM_ATTRIBUTES+WEB_API' : (results.length > 0 ? 'FORM_ATTRIBUTES' : 'NONE'),
          entityName: extractedEntityName,
          found: results.length,
          currentValuesAvailable: Object.keys(currentValueMap).length,
          retrievalMethods: results.some((result) => result.source === 'Web API') ? ['Form Attributes', 'Web API'] : ['Form Attributes']
        }
      };
    } catch (error) {
      console.error('[D365-Ext] Unexpected error:', error.message, error.stack);
      return {
        url: location.href,
        hasXrm: false,
        optionSets: [],
        errors: ['Failed to collect option sets: ' + error.message],
        diagnostics: {
          method: 'ERROR',
          error: error.message
        }
      };
    }
  })();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === 'getOptionSetValues') {
    (async () => {
      try {
        const result = await collectOptionSetValues();
        sendResponse(result);
      } catch (error) {
        sendResponse({
          url: location.href,
          hasXrm: false,
          optionSets: [],
          errors: [error.message]
        });
      }
    })();
    return true;
  }
});
