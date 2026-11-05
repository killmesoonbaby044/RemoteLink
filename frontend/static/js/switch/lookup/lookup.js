// Entry point for the "MAC address lookup" block (template/pages/switch/switch_lookup.html).
// Wires together the target picker, the mac-suffix autosuggest, and the
// results view -- the actual logic for each of those lives in its own
// module in this folder.

import {fetchRootPointGroups, fetchRootPoints} from "./inventory-adapter.js";
import {createAutosuggest} from "../../common/autosuggest.js";
import {getRecentSearches, pushSearch} from "../../shared/history/store.js";
import {
    ACTION_ENDPOINTS,
    MAC_HISTORY_KIND,
    NO_MAC_ACTIONS,
    ROOT_POINT_RADIO_NAME,
    TARGET_RADIO_NAME
} from "./config.js";
import {createTargetPicker} from "./target-picker.js";
import {renderError, renderResults} from "./results.js";
import * as dom from "./dom.js";
import {hasCredentials} from "../../shared/credentials/store.js";

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

// Err-disabled lookup has no MAC to search for: hide the field (and drop
// `required`, or the browser would block the submit on a hidden input).
function syncMacField() {
    const needsMac = !NO_MAC_ACTIONS.has(dom.actionSelect.value);
    if (dom.macField) dom.macField.hidden = !needsMac;
    if (dom.macInput) dom.macInput.required = needsMac;
}
dom.actionSelect?.addEventListener("change", syncMacField);
syncMacField();

// Bumped per run and per target change, so a slow answer can't draw its
// results under a different target.
let currentRun = 0;

dom.form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!hasCredentials()) {
        window.location.href = "/credentials";
        return;
    }

    const action = dom.actionSelect.value;
    const needsMac = !NO_MAC_ACTIONS.has(action);
    const mac = dom.macInput.value.trim();
    const targets = targetPicker.getSelectedTargets();
    const endpoint = ACTION_ENDPOINTS[action];

    if ((needsMac && !mac) || !targets.length || !endpoint) {
        return;
    }

    dom.submitButton.disabled = true;
    dom.submitButton.textContent = "Looking up…";
    dom.resultsEl.hidden = true;
    const run = ++currentRun;

    try {
        // NOTE: `group` is now always a list of strings, for all the MAC
        // actions (static/trunk share this one request body):
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
                ...(fixedTarget && { kind: fixedTarget.kind }),
                ...(needsMac && { mac_suffix: mac }),
                username: localStorage.getItem("ssh_username"),
                password: localStorage.getItem("ssh_password"),
            }),
        });

        if (run !== currentRun) return; // the target changed while this was running

        if (!response.ok) {
            renderError(dom.resultsEl, `Lookup failed (${response.status}).`);
            return;
        }

        const data = await response.json();
        if (run !== currentRun) return;
        if (needsMac) pushSearch(MAC_HISTORY_KIND, mac);
        renderResults(dom.resultsEl, data.results, { errDisabled: !needsMac });
    } catch (err) {
        if (run !== currentRun) return;
        renderError(dom.resultsEl, "Lookup failed - check your connection and try again.");
        console.error(err);
    } finally {
        dom.submitButton.disabled = false;
        dom.submitButton.textContent = "Look up";
    }
});

targetPicker.populateTargets();

export const reloadTargets = () => targetPicker.populateTargets();

const BADGES = { root: "R", group: "G", host: "H" };
let fixedTarget = null;

// Runs the lookup against one inventory item ({kind, name}) instead of what's
// picked in the form; null goes back to the picker. Results on show belong to
// the previous target, so they go when it changes.
export function setLookupTarget(target) {
    if (target?.kind === fixedTarget?.kind && target?.name === fixedTarget?.name) return;
    fixedTarget = target;
    currentRun++;

    targetPicker.setFixedTarget(target ? target.name : null);
    dom.fixedTarget.hidden = !target;
    dom.targetPicker.hidden = Boolean(target);
    if (target) {
        dom.fixedBadge.className = `tree-badge tree-badge-${target.kind}`;
        dom.fixedBadge.textContent = BADGES[target.kind];
        dom.fixedName.textContent = target.name;
    }

    dom.resultsEl.hidden = true;
    dom.resultsEl.innerHTML = "";
}

dom.fixedChange?.addEventListener("click", () => setLookupTarget(null));

// The first field that's actually on show for the current lookup type.
export function focusLookup() {
    (dom.macField?.hidden ? dom.actionSelect : dom.macInput)?.focus();
}
