// Shared "terminal history" storage: every SSH connection and script run
// gets recorded here (capped at HISTORY_CAP entries), and read back by
// both the header "History" dropdown and the host-field autosuggest.
// A separate, smaller list per search "kind" (e.g. "user", "pc") tracks
// raw search queries for each search field's own autosuggest -- kept
// distinct per kind so a recent PC search doesn't show up in the user
// search field and vice versa.

import { packScriptRef } from "./script-ref.js";

const STORAGE_KEY = "terminal_history";
const HISTORY_CAP = 15;

function readList(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
        return [];
    }
}

export function getHistory() {
    return readList(STORAGE_KEY);
}

// Two entries count as "the same" if they'd render as the same row --
// same connection target for ssh, same script+argument for script runs.
// Used by pushHistory to move a repeated action back to the top instead
// of piling up duplicates.
function isSameEntry(a, b) {
    if (a.type !== b.type) {
        return false;
    }

    if (a.type === "ssh") {
        return a.host === b.host;
    }

    if (a.type === "script") {
        return a.path === b.path && (a.name || null) === (b.name || null);
    }

    return false;
}

export function pushHistory(entry, cap = HISTORY_CAP) {
    const history = getHistory().filter((existing) => !isSameEntry(existing, entry));
    history.unshift(entry);
    history.splice(cap);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return history;
}

// SSH hosts only, de-duplicated, most recent first -- powers the
// host-history autosuggest dropdown on the connect form.
export function getRecentHosts() {
    const seen = new Set();
    const hosts = [];

    getHistory().forEach((entry) => {
        if (entry.type === "ssh" && entry.host && !seen.has(entry.host)) {
            seen.add(entry.host);
            hosts.push(entry.host);
        }
    });

    return hosts;
}

function searchHistoryKey(kind) {
    return `search_history:${kind}`;
}

export function getRecentSearches(kind) {
    return readList(searchHistoryKey(kind));
}

export function pushSearch(kind, query, cap = HISTORY_CAP) {
    const searches = getRecentSearches(kind).filter((item) => item !== query);
    searches.unshift(query);
    searches.splice(cap);
    localStorage.setItem(searchHistoryKey(kind), JSON.stringify(searches));
    return searches;
}

// Builds one DOM row for a history entry, or null if it can't be rendered
// (unknown type, malformed script path).
export function buildHistoryRow(entry) {
    const row = document.createElement("div");
    row.className = "terminal-history-row";

    const iconCell = document.createElement("span");
    iconCell.className = "terminal-history-icon";

    const contentCell = document.createElement("span");
    contentCell.className = "terminal-history-content";

    const link = document.createElement("a");
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    if (entry.type === "ssh") {
        const icon = document.createElement("img");
        icon.src = "/static/icons/ssh.ico";
        icon.alt = "SSH";
        iconCell.appendChild(icon);

        link.href = `/terminal?host=${encodeURIComponent(entry.host)}`;
        link.textContent = entry.host;

    } else if (entry.type === "script") {
        const pathParts = entry.path.split(/[\\/]/).filter(Boolean);

        if (pathParts.length < 2) {
            return null;
        }

        const directory = pathParts[pathParts.length - 2];
        const filename = pathParts[pathParts.length - 1].replace(/\.[^/.]+$/, "");

        const displayName = entry.name
            ? `${directory}\\${filename} ${entry.name}`
            : `${directory}\\${filename}`;

        // Falsy-safe: unlike the old inline version, this no longer packs
        // the literal string "undefined" into the ref when entry.name is
        // missing (plain, non-targeted script runs).
        const scriptRef = packScriptRef(`${directory}\\${filename}`, entry.name);

        const icon = document.createElement("img");
        icon.src = "/static/icons/script.ico";
        icon.alt = "Script";
        iconCell.appendChild(icon);

        link.href = `/terminal?script=${encodeURIComponent(scriptRef)}`;
        link.textContent = displayName;

    } else {
        return null;
    }

    contentCell.appendChild(link);
    row.appendChild(iconCell);
    row.appendChild(contentCell);
    return row;
}

export function renderHistoryList(container, { filter } = {}) {
    if (!container) {
        return;
    }

    container.innerHTML = "";

    getHistory()
        .filter((entry) => !filter || filter(entry))
        .forEach((entry) => {
            const row = buildHistoryRow(entry);
            if (row) {
                container.appendChild(row);
            }
        });
}