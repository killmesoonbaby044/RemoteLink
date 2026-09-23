/**
 * "Recently chosen OU" list for the Add user page's OU picker.
 *
 * Deliberately its OWN localStorage key - NOT shared/history's
 * `terminal_history` and NOT domain/search's `search_history:<kind>`.
 * OU picks are a convenience for this one picker only; they must never
 * show up in the header History dropdown or any other history surface.
 * Stores {name, dn} pairs (display shows name only, dn is what
 * actually gets submitted) rather than plain strings.
 */

const STORAGE_KEY = "domain_add_user_ou_history";
// Matches shared/history/store.js's HISTORY_CAP - same "recent list"
// convention, just a separate key (see the file header above).
const CAP = 15;

function readList() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function getRecentOus() {
    return readList();
}

export function pushRecentOu({ name, dn }, cap = CAP) {
    if (!dn) {
        return getRecentOus();
    }

    const list = getRecentOus().filter((item) => item.dn !== dn);
    list.unshift({ name, dn });
    list.splice(cap);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return list;
}
