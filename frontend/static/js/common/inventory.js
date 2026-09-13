// Adjust this if your API router is mounted under a prefix (e.g. "/api").
const API_BASE = "";

/**
 * Fetches the flat list of hosts and groups from the inventory store.
 * Nesting inside groups (a group's `members` can include other group
 * names) doesn't matter here - the lookup endpoint resolves that
 * server-side. We just need every host/group *name* so the user can
 * pick one as the lookup target.
 */
export async function fetchInventoryTargets() {
    const [hostsRes, groupsRes] = await Promise.all([
        fetch(`${API_BASE}/inventory/hosts`, { credentials: "same-origin" }),
        fetch(`${API_BASE}/inventory/groups`, { credentials: "same-origin" }),
    ]);

    if (!hostsRes.ok || !groupsRes.ok) {
        throw new Error("Failed to load inventory");
    }

    const hosts = await hostsRes.json();
    const groups = await groupsRes.json();

    return {
        hosts: hosts.map((h) => h.name).sort((a, b) => a.localeCompare(b)),
        groups: groups.map((g) => g.name).sort((a, b) => a.localeCompare(b)),
    };
}

/**
 * Fetches the list of root point names (e.g. one per building). Root
 * points are the top level of the "Run against" picker on the MAC
 * lookup form - once one is picked, fetchRootPointGroups() drills into
 * the groups that belong to it.
 */
export async function fetchRootPoints() {
    const res = await fetch(`${API_BASE}/inventory/root-points`, { credentials: "same-origin" });

    if (!res.ok) {
        throw new Error("Failed to load root points");
    }

    const rootPoints = await res.json();

    if (!Array.isArray(rootPoints)) {
        throw new Error("Unexpected response loading root points");
    }

    return rootPoints.map((r) => r.name).sort((a, b) => a.localeCompare(b));
}

/**
 * Fetches the group names that belong to a given root point.
 *
 * Assumes the RootPoint schema exposes a `groups` field (list of group
 * names) on the object returned by GET /inventory/root-points/{name}.
 * If your schema names that field differently, update the property
 * accessed below.
 */
export async function fetchRootPointGroups(name) {
    const res = await fetch(`${API_BASE}/inventory/root-points/${encodeURIComponent(name)}`, { credentials: "same-origin" });

    if (!res.ok) {
        throw new Error("Failed to load root point");
    }

    const rootPoint = await res.json();
    const groups = Array.isArray(rootPoint?.members) ? rootPoint.members : [];
    return groups.slice().sort((a, b) => a.localeCompare(b));
}