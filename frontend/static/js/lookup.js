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
function renderTargetList(container, names, radioName) {
    container.innerHTML = "";
    for (const name of names) {
        const label = document.createElement("label");
        label.className = "search-result-label";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.className = "search-result-radio";
        radio.name = radioName;
        radio.value = name;

        const span = document.createElement("span");
        span.className = "search-result-name";
        span.textContent = name;

        label.append(radio, span);
        container.append(label);
    }
}

// Once a root point is checked, drill into it and show the groups it
// contains - that's the actual lookup target (step 3 sends the chosen
// group's name, not the root point's).
async function loadGroupsForRootPoint(rootPointName) {
    groupsBlock.hidden = false;
    groupsList.innerHTML = "";
    groupsStatus.hidden = false;
    groupsStatus.textContent = "Loading groups…";
    if (submitButton) submitButton.disabled = true;

    try {
        const groups = await fetchRootPointGroups(rootPointName);

        if (!groups.length) {
            groupsStatus.textContent = "This root point has no groups.";
            return;
        }

        renderTargetList(groupsList, groups, TARGET_RADIO_NAME);
        groupsStatus.hidden = true;
        if (submitButton) submitButton.disabled = false;
    } catch (err) {
        groupsStatus.hidden = false;
        groupsStatus.textContent = "Failed to load groups.";
        console.error(err);
    }
}

rootPointsList?.addEventListener("change", (event) => {
    if (event.target?.name !== ROOT_POINT_RADIO_NAME) return;
    loadGroupsForRootPoint(event.target.value);
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
    } catch (err) {
        lockLookupForm("Failed to load inventory.");
        console.error(err);
    }
}

// The exact field names on HostTaskResult weren't available when this was
// written, so this reads a few likely candidates defensively. If your
// schema uses different names, adjust the candidate lists below - the
// rest of the rendering doesn't need to change.
function pick(obj, candidates, fallback = undefined) {
    for (const key of candidates) {
        if (obj && obj[key] !== undefined) return obj[key];
    }
    return fallback;
}

function renderResults(results) {
    resultsEl.innerHTML = "";
    resultsEl.hidden = false;

    if (!Array.isArray(results) || !results.length) {
        resultsEl.append(Object.assign(document.createElement("p"), {
            className: "lookup-empty",
            textContent: "No results.",
        }));
        return;
    }

    for (const item of results) {
        const host = pick(item, ["host", "hostname", "name"], "unknown host");
        const ok = pick(item, ["success", "ok"], null);
        const output = pick(item, ["output", "result", "data"]);
        const error = pick(item, ["error", "message"]);

        const row = document.createElement("div");
        row.className = "lookup-result";

        const status = document.createElement("span");
        status.className = `lookup-status ${ok === false ? "lookup-status-error" : "lookup-status-ok"}`;
        status.textContent = ok === false ? "failed" : "ok";

        const title = document.createElement("span");
        title.className = "lookup-result-host";
        title.textContent = host;

        const header = document.createElement("div");
        header.className = "lookup-result-header";
        header.append(title, status);
        row.append(header);

        const body = document.createElement("pre");
        body.className = "lookup-result-body";
        body.textContent = error ? String(error) : (output ? String(output) : "(empty response)");
        row.append(body);

        resultsEl.append(row);
    }
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
    const target = form.querySelector(`input[name="${TARGET_RADIO_NAME}"]:checked`)?.value;
    const endpoint = ACTION_ENDPOINTS[actionSelect.value];

    if (!mac || !target || !endpoint) {
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Looking up…";
    resultsEl.hidden = true;

    try {
        // NOTE: MacLookupRequest currently only has `group` (a group name
        // under the chosen root point) and `mac_suffix`. Update this body
        // if the finalized schema adds more fields.
        const response = await fetch(endpoint, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                group: target,
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