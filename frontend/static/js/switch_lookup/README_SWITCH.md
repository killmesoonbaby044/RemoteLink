# SWITCH_LOOKUP

- **config.js** — endpoint map, radio-name constants, the mac-lookup history kind.
- **dom.js** — every getElementById call in one place.
- **target-picker.js** — the generic root-point/group drill-down widget (createTargetPicker), no knowledge of MAC lookups specifically.
- **results.js** — pure renderResults/renderError.
- **lookup.js** — thin orchestrator: wires autosuggest, the target picker, and the submit handler together.
