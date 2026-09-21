// Config for the "MAC address lookup" block (templates/switches.html).

// Adjust this if your API router is mounted under a prefix (e.g. "/api").
export const API_BASE = "";

// action <select> value -> endpoint from switch.py
export const ACTION_ENDPOINTS = {
    "static": `${API_BASE}/tasks/mac-lookup`,
    "trunk": `${API_BASE}/tasks/mac-lookup-trunk`,
    "port-security": `${API_BASE}/tasks/port-security-lookup`,
};

export const ROOT_POINT_RADIO_NAME = "lookup-root-point-choice";
export const TARGET_RADIO_NAME = "lookup-target-choice";

// Own search-history "kind" so recent MAC lookups don't mix with any
// other field's autosuggest (e.g. "user"/"pc" search fields) -- see
// getRecentSearches/pushSearch in shared/history/store.js.
export const MAC_HISTORY_KIND = "mac-lookup";
