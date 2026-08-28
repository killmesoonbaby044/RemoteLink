// Generic "search for an entity (a user, a PC, ...), pick one, reveal its
// scripts" controller. "Search users" and "Search PC" on the home page
// are the same feature with different data -- this is the one place that
// feature is implemented; each block just supplies its own DOM ids,
// script name (via data-search-script, set server-side), and a "kind"
// used to keep each block's search history and script-ref packing
// separate from the other's.

import { openTypedSocket } from "./ws.js";
import { pushHistory, getRecentSearches, pushSearch } from "./history.js";
import { packScriptRef } from "./script-ref.js";
import { createAutosuggest } from "./autosuggest.js";

export function initEntitySearch({
    kind,
    formId,
    inputId,
    statusId,
    resultsId,
    scriptsSectionId,
    scriptsTargetId,
}) {
    const form = document.getElementById(formId);
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    const results = document.getElementById(resultsId);

    if (!form || !input || !status || !results) {
        return;
    }

    const searchScript = form.dataset.searchScript;

    const scriptsSection = document.getElementById(scriptsSectionId);
    const scriptsTarget = document.getElementById(scriptsTargetId);
    const scriptLinkClass = `${kind}-script-link`;
    const scriptLinks = scriptsSection
        ? Array.from(scriptsSection.querySelectorAll(`.${scriptLinkClass}`))
        : [];

    createAutosuggest({
        wrapper: document.getElementById(`${inputId}-wrapper`),
        input,
        menu: document.getElementById(`${inputId}-menu`),
        getItems: () => getRecentSearches(kind),
    });

    function setStatus(text) {
        status.textContent = text || "";
    }

    // Points each script in the revealed block at this entity and shows
    // the block -- same script cards as "Run a script", just with the
    // checked name packed in as the argument (same pack convention as
    // everywhere else scripts run with a parameter).
    function showScripts(name) {
        scriptLinks.forEach((link) => {
            const scriptName = link.dataset.script;
            const scriptRef = packScriptRef(`${kind}\\${scriptName}`, name);
            link.href = `/terminal?script=${encodeURIComponent(scriptRef)}`;
        });

        if (scriptsTarget) {
            scriptsTarget.textContent = name;
        }

        if (scriptsSection) {
            scriptsSection.dataset.targetName = name;
        }

        scriptsSection?.removeAttribute("hidden");
    }

    function hideScripts() {
        scriptsSection?.setAttribute("hidden", "");
    }

    // Recorded the same way a plain script run records itself -- same
    // shared pushHistory() call, just at click time instead of waiting on
    // a WS message, since the browser already has everything the message
    // would have carried.
    scriptsSection?.addEventListener("click", (event) => {
        const link = event.target.closest(`.${scriptLinkClass}`);
        if (!link) {
            return;
        }

        const scriptName = link.dataset.script;
        const targetName = scriptsSection.dataset.targetName;

        if (!scriptName || !targetName) {
            return;
        }

        pushHistory({ type: "script", path: `${kind}\\${scriptName}`, name: targetName });
    });

    function renderResults(names) {
        results.innerHTML = "";
        hideScripts();

        if (!names.length) {
            setStatus("No matches found.");
            return;
        }

        setStatus(`${names.length} found — check one to continue.`);

        names.forEach((name) => {
            const row = document.createElement("label");
            row.className = "search-result-label";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = `${kind}-search-result`;
            checkbox.className = "search-result-radio";
            checkbox.value = name;

            const nameSpan = document.createElement("span");
            nameSpan.className = "search-result-name";
            nameSpan.textContent = name;

            row.appendChild(checkbox);
            row.appendChild(nameSpan);
            results.appendChild(row);

            checkbox.addEventListener("change", () => {
                const rows = results.querySelectorAll(".search-result-label");
                const boxes = results.querySelectorAll(".search-result-radio");

                if (checkbox.checked) {
                    // Only one at a time -- uncheck any other.
                    boxes.forEach((other) => {
                        if (other !== checkbox) {
                            other.checked = false;
                        }
                    });

                    // Shrink: hide every row except the checked one.
                    rows.forEach((r) => {
                        r.hidden = r !== row;
                    });

                    showScripts(name);
                } else {
                    // Expand: show the full list again.
                    rows.forEach((r) => {
                        r.hidden = false;
                    });

                    hideScripts();
                }
            });
        });
    }

    function search(query) {
        if (!searchScript) {
            setStatus("Search isn't configured (missing data-search-script).");
            return;
        }

        results.innerHTML = "";
        setStatus("Searching...");
        pushSearch(kind, query);

        const scriptRef = packScriptRef(searchScript, query);

        openTypedSocket(`/ws/script?name=${encodeURIComponent(scriptRef)}`, {
            onError: () => setStatus("WebSocket error."),
            types: {
                search_results: (message, socket) => {
                    renderResults(message.results || message.computers || message.users || []);
                    socket.close();
                },
                error: (message, socket) => {
                    setStatus(message.message || "Search failed.");
                    socket.close();
                },
                // "status" messages (e.g. "Starting search...") have
                // nowhere to go here since there's no terminal -- ignored
                // on purpose.
            },
        });
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const query = input.value.trim();
        if (!query) {
            return;
        }

        search(query);
    });
}
