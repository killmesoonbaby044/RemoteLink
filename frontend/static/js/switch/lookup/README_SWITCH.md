# SWITCH_LOOKUP

- **config.js** — endpoint map, radio-name constants, the mac-lookup history kind.
- **dom.js** — every getElementById call in one place.
- **inventory-adapter.js** — adapts switch/inventory/api.js's raw objects into the plain sorted name lists target-picker.js expects, so this feature and the inventory admin page share one inventory client.
- **target-picker.js** — the generic root-point/group drill-down widget (createTargetPicker), no knowledge of MAC lookups specifically.
- **results.js** — pure renderResults/renderError.
- **lookup.js** — thin orchestrator: wires autosuggest, the target picker, and the submit handler together.
