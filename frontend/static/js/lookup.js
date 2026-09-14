import { fetchRootPoints, fetchRootPointGroups } from "./common/inventory.js";

// Adjust this if your API router is mounted under a prefix (e.g. "/api").
const API_BASE = "";

// action <select> value -> endpoint from switch.py
const ACTION_ENDPOINTS = {
    "static": `${API_BASE}/tasks/mac-lookup`,
    "trunk": `${API_BASE}/tasks/mac-lookup-trunk`,
    "port-security": `${API_BASE}/tasks/port-security-lookup`,
};

const ROOT_POINT_RADIO_NAME = "lookup-root-point-choice";
const TARGET_RADIO_NAME = "lookup-target-choice";

const form = document.getElementById("lookup-form");
const macInput = document.getElementById("mac-suffix");
const actionSelect = document.getElementById("lookup-action");
const targetStatus = document.getElementById("lookup-target-status");
const rootPointsBlock = document.getElementById("lookup-target-root-points-block");
const rootPointsList = document.getElementById("lookup-target-root-points");
const groupsBlock = document.getElementById("lookup-target-groups-block");
const groupsStatus = document.getElementById("lookup-target-groups-status");
const groupsList = document.getElementById("lookup-target-groups");
const resultsEl = document.getElementById("lookup-results");
const submitButton = form?.querySelector("button[type=submit]");

// Same markup/classes as the Search users / Search PC result lists
// (see search.css: .search-results / .search-result-label / etc.)
// so this picker looks and behaves like the rest of the app.
function renderTargetList(container, names, inputName, inputType = "radio") {
    container.innerHTML = "";
    for (const name of names) {
        const label = document.createElement("label");
        label.className = "search-result-label";

        const input = document.createElement("input");
        input.type = inputType;
        input.className = "search-result-radio";
        input.name = inputName;
        input.value = name;

        const span = document.createElement("span");
        span.className = "search-result-name";
        span.textContent = name;

        label.append(input, span);
        container.append(label);
    }
}

// A root point on its own is a valid lookup target. Groups (checkboxes,
// so more than one can be picked) narrow it down further - if any are
// checked they win over the root point. The result is always an array:
// the checked groups, or the root point as a single-item array, or an
// empty array if nothing is selected yet.
function getSelectedTargets() {
    const checkedGroups = Array.from(
        form.querySelectorAll(`input[name="${TARGET_RADIO_NAME}"]:checked`)
    ).map((input) => input.value);

    if (checkedGroups.length) return checkedGroups;

    const rootPoint = form.querySelector(`input[name="${ROOT_POINT_RADIO_NAME}"]:checked`)?.value;
    return rootPoint ? [rootPoint] : [];
}

function updateSubmitAvailability() {
    if (submitButton) submitButton.disabled = getSelectedTargets().length === 0;
}

// Resets the groups UI, e.g. when the root point is deselected or
// switched - there's nothing valid to show or keep checked anymore.
function clearGroupSelection() {
    groupsBlock.hidden = true;
    groupsList.innerHTML = "";
    groupsStatus.hidden = true;
}

// Once a root point is checked, drill into it and show the groups it
// contains so the lookup can be narrowed further. The root point itself
// is already a usable target at this point (see getSelectedTargets), so
// this is just an optional refinement, not a prerequisite.
async function loadGroupsForRootPoint(rootPointName) {
    groupsBlock.hidden = false;
    groupsList.innerHTML = "";
    groupsStatus.hidden = false;
    groupsStatus.textContent = "Loading groups…";
    updateSubmitAvailability();

    try {
        const groups = await fetchRootPointGroups(rootPointName);

        if (!groups.length) {
            groupsStatus.textContent = "This root point has no groups - you can still look up against the root point itself.";
            return;
        }

        renderTargetList(groupsList, groups, TARGET_RADIO_NAME, "checkbox");
        groupsStatus.hidden = true;
    } catch (err) {
        groupsStatus.hidden = false;
        groupsStatus.textContent = "Failed to load groups - you can still look up against the root point itself.";
        console.error(err);
    } finally {
        updateSubmitAvailability();
    }
}

// Tracks which root point is currently checked, purely so a click on the
// already-checked radio can be recognized as "clear it" - native radios
// don't uncheck themselves on a repeat click the way checkboxes do.
let checkedRootPointValue = null;

rootPointsList?.addEventListener("click", (event) => {
    const input = event.target;
    if (input?.name !== ROOT_POINT_RADIO_NAME) return;
    if (input.value === checkedRootPointValue) {
        input.checked = false;
        checkedRootPointValue = null;
        clearGroupSelection();
        updateSubmitAvailability();
    }
});

rootPointsList?.addEventListener("change", (event) => {
    if (event.target?.name !== ROOT_POINT_RADIO_NAME) return;
    checkedRootPointValue = event.target.value;
    loadGroupsForRootPoint(event.target.value);
});

form?.addEventListener("change", (event) => {
    if (event.target?.name === ROOT_POINT_RADIO_NAME || event.target?.name === TARGET_RADIO_NAME) {
        updateSubmitAvailability();
    }
});

// Safe-check: with no root point to pick, there's nothing valid to run
// a lookup against, so lock the rest of the form down rather than just
// the submit button (e.g. Enter in the MAC field would otherwise still
// submit).
function lockLookupForm(message) {
    targetStatus.textContent = message;
    if (macInput) macInput.disabled = true;
    if (actionSelect) actionSelect.disabled = true;
    if (submitButton) submitButton.disabled = true;
}

async function populateTargets() {
    if (!targetStatus) return;

    try {
        const rootPoints = await fetchRootPoints();

        if (!rootPoints.length) {
            lockLookupForm("No root points found in your inventory.");
            return;
        }

        renderTargetList(rootPointsList, rootPoints, ROOT_POINT_RADIO_NAME);
        rootPointsBlock.hidden = false;
        targetStatus.textContent = "";
        updateSubmitAvailability();
    } catch (err) {
        lockLookupForm("Failed to load inventory.");
        console.error(err);
    }
}

// HostTaskResult puts parsed hits under `matches` (see switch_runtime.py /
// schemas.py) - each entry has host, vlan, mac, type, interface. A host
// that errored, or that ran fine but found nothing, contributes no rows:
// the point of this view is "where was it found", not a per-host status.
function renderResults(results) {
    resultsEl.innerHTML = "";
    resultsEl.hidden = false;

    if (!Array.isArray(results)) {
        resultsEl.append(Object.assign(document.createElement("p"), {
            className: "lookup-empty",
            textContent: "No results.",
        }));
        return;
    }

    const rows = [];
    for (const item of results) {
        if (!item.ok || !Array.isArray(item.matches)) continue;
        for (const match of item.matches) {
            rows.push({
                host: match.host || item.host,
                address: item.address,
                vlan: match.vlan,
                mac: match.mac,
                interface: match.interface,
            });
        }
    }

    if (!rows.length) {
        resultsEl.append(Object.assign(document.createElement("p"), {
            className: "lookup-empty",
            textContent: "No matches found.",
        }));
        return;
    }

    const table = document.createElement("table");
    table.className = "lookup-results-table";

    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Host</th><th>VLAN</th><th>MAC</th><th>Interface</th></tr>";
    table.append(thead);

    const tbody = document.createElement("tbody");
    for (const row of rows) {
        const tr = document.createElement("tr");

        // An <a> can't legally wrap a <tr> (browsers will hoist it out and
        // break the table), so instead each cell's content is wrapped in a
        // full-cell link. That makes the whole row behave like a link -
        // ctrl/cmd-click, right-click "open in new tab", etc. all work.
        // Add `display: block` (plus your normal cell padding) on
        // .lookup-results-row-link in CSS so the link fills the <td>.
        const terminalHref = row.host
            ? `/terminal?host=${encodeURIComponent(row.address)}`
            : null;

        for (const value of [row.host, row.vlan, row.mac, row.interface]) {
            const td = document.createElement("td");
            if (terminalHref && value === row.host) {
                const link = document.createElement("a");
                link.className = "lookup-results-host-link";
                link.href = terminalHref;
                link.textContent = value ?? "";
                td.append(link);
            } else {
                td.textContent = value ?? "";
            }
            tr.append(td);
        }
        tbody.append(tr);
    }
    table.append(tbody);

    const wrap = document.createElement("div");
    wrap.className = "lookup-results-table-wrap";
    wrap.append(table);

    resultsEl.append(wrap);
}

function renderError(message) {
    resultsEl.innerHTML = "";
    resultsEl.hidden = false;
    resultsEl.append(Object.assign(document.createElement("p"), {
        className: "lookup-empty lookup-error",
        textContent: message,
    }));
}

form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const mac = macInput.value.trim();
    const targets = getSelectedTargets();
    const endpoint = ACTION_ENDPOINTS[actionSelect.value];

    if (!mac || !targets.length || !endpoint) {
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Looking up…";
    resultsEl.hidden = true;

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
            renderError(`Lookup failed (${response.status}).`);
            return;
        }

        const data = await response.json();
        renderResults(data.results);
    } catch (err) {
        renderError("Lookup failed - check your connection and try again.");
        console.error(err);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Look up";
    }
});

populateTargets();
