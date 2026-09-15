// Entry point for the "MAC address lookup" block (templates/switches.html).
// Wires together the target picker, the mac-suffix autosuggest, and the
// results view -- the actual logic for each of those lives in its own
// module in this folder.

import { fetchRootPoints, fetchRootPointGroups } from "../common/inventory.js";
import { createAutosuggest } from "../common/autosuggest.js";
import { getRecentSearches, pushSearch } from "../common/history.js";
import { ACTION_ENDPOINTS, ROOT_POINT_RADIO_NAME, TARGET_RADIO_NAME, MAC_HISTORY_KIND } from "./config.js";
import { createTargetPicker } from "./target-picker.js";
import { renderResults, renderError } from "./results.js";
import * as dom from "./dom.js";
import {hasCredentials} from "../common/credentials.js";

if (dom.macInput) {
    createAutosuggest({
        wrapper: dom.macWrapper,
        input: dom.macInput,
        menu: dom.macMenu,
        getItems: () => getRecentSearches(MAC_HISTORY_KIND),
    });
}

const targetPicker = createTargetPicker({
    form: dom.form,
    rootPointRadioName: ROOT_POINT_RADIO_NAME,
    targetRadioName: TARGET_RADIO_NAME,
    rootPointsBlock: dom.rootPointsBlock,
    rootPointsList: dom.rootPointsList,
    groupsBlock: dom.groupsBlock,
    groupsList: dom.groupsList,
    groupsStatus: dom.groupsStatus,
    targetStatus: dom.targetStatus,
    submitButton: dom.submitButton,
    disableOnEmpty: [dom.macInput, dom.actionSelect],
    fetchRootPoints,
    fetchRootPointGroups,
});

dom.form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!hasCredentials()) {
        window.location.href = "/credentials";
        return;
    }

    const mac = dom.macInput.value.trim();
    const targets = targetPicker.getSelectedTargets();
    const endpoint = ACTION_ENDPOINTS[dom.actionSelect.value];

    if (!mac || !targets.length || !endpoint) {
        return;
    }

    dom.submitButton.disabled = true;
    dom.submitButton.textContent = "Looking up…";
    dom.resultsEl.hidden = true;

    try {
        // NOTE: `group` is now always a list of strings, for all three
        // actions (static/trunk/port-security share this one request body):
        // either the checked groups under a root point, or - if none were
        // picked - the root point's own name as a single-item list. Confirm
        // MacLookupRequest.group accepts a list (and, for the root-point
        // case, that a root point name is valid there too).
        const response = await fetch(endpoint, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                group: targets,
                mac_suffix: mac,
                username: localStorage.getItem("ssh_username"),
                password: localStorage.getItem("ssh_password"),
            }),
        });

        if (!response.ok) {
            renderError(dom.resultsEl, `Lookup failed (${response.status}).`);
            return;
        }

        const data = await response.json();
        pushSearch(MAC_HISTORY_KIND, mac);
        renderResults(dom.resultsEl, data.results);
    } catch (err) {
        renderError(dom.resultsEl, "Lookup failed - check your connection and try again.");
        console.error(err);
    } finally {
        dom.submitButton.disabled = false;
        dom.submitButton.textContent = "Look up";
    }
});

targetPicker.populateTargets();
