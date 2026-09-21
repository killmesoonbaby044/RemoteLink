// Adapts switch/inventory/api.js's raw objects into the plain sorted
// name lists target-picker.js expects. This replaces common/inventory.js
// - switch/lookup now goes through the same inventory client as the
// inventory admin page instead of a second, separate one (both used to
// hit /inventory/root-points independently, with their own fetch
// wrappers and error handling).
//
// Root point members are read from the raw GET /root-points/{name}
// (RootPoint.members, per schemas.py) - not the /resolve endpoint,
// which returns fully-resolved Host objects instead of names.

import { api } from "../inventory/api.js";

function sortedNames(items) {
    return items.map((item) => item.name).sort((a, b) => a.localeCompare(b));
}

export async function fetchRootPoints() {
    return sortedNames(await api.list("root"));
}

export async function fetchRootPointGroups(name) {
    const rootPoint = await api.get("root", name);
    const members = Array.isArray(rootPoint?.members) ? rootPoint.members : [];
    return members.slice().sort((a, b) => a.localeCompare(b));
}
