/**
 * Hierarchy tab - read only.
 *
 * This view is for understanding the tree, not editing it: no attach/
 * detach controls here at all. To change membership, edit a group or
 * root point from its table (the Groups / Root points tabs), which goes
 * through the normal create+edit modal.
 *
 * Default expand state: root points and groups render expanded so the
 * group/subgroup structure is visible at a glance. Each node's hosts are
 * tucked behind their own collapsed "N hosts" toggle so a group with a
 * lot of hosts doesn't drown out the structure - click it to reveal them.
 */

import { state, byName, splitMembers, el, renderEmptyBlock } from "./core.js";

function chevron() {
    const span = document.createElement("span");
    span.className = "tree-chevron";
    span.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3l5 5-5 5"/></svg>';
    return span;
}

function hostLeaf(hostName, hostsByName) {
    const host = hostsByName.get(hostName);
    const trailing = [];
    if (host && host.address) trailing.push(el("span", { class: "tree-meta", text: host.address }));
    else if (!host) trailing.push(el("span", { class: "tree-warn", text: "not found" }));
    return el("div", { class: "tree-leaf" }, [
        el("span", { class: "tree-badge tree-badge-host", text: "H" }),
        el("span", { class: "tree-name", text: hostName }),
        el("span", { class: "tree-trailing" }, trailing),
    ]);
}

/** Collapsed-by-default "N hosts" toggle nested under a root/group node.
 *  Returns null when there are no hosts to show, so callers can skip it. */
function hostsSection(hostNames, hostsByName) {
    if (hostNames.length === 0) return null;

    const details = el("details", { class: "tree-node" }); // no "open" - collapsed by default
    details.appendChild(el("summary", { class: "tree-row" }, [
        chevron(),
        el("span", { class: "tree-badge tree-badge-host", text: "H" }),
        el("span", { class: "tree-name", text: "Hosts" }),
        el("span", { class: "tree-trailing" }, [
            el("span", { class: "tree-meta", text: `${hostNames.length} host${hostNames.length === 1 ? "" : "s"}` }),
        ]),
    ]));

    const children = el("div", { class: "tree-children" });
    for (const hName of hostNames) children.appendChild(hostLeaf(hName, hostsByName));
    details.appendChild(children);
    return details;
}

function renderRootNode(root, groupsByName, hostsByName) {
    const { hostNames, groupNames } = splitMembers(root.members, hostsByName, groupsByName);
    const summaryMeta = `${groupNames.length} group${groupNames.length === 1 ? "" : "s"} · ${hostNames.length} host${hostNames.length === 1 ? "" : "s"}`;

    const details = el("details", { class: "tree-node", open: true });
    details.appendChild(el("summary", { class: "tree-row" }, [
        chevron(),
        el("span", { class: "tree-badge tree-badge-root", text: "R" }),
        el("span", { class: "tree-name", text: root.name }),
        el("span", { class: "tree-trailing" }, [el("span", { class: "tree-meta", text: summaryMeta })]),
    ]));

    const children = el("div", { class: "tree-children" });
    if ((root.members || []).length === 0) {
        children.appendChild(el("p", { class: "inv-empty", text: "Nothing attached to this root point yet." }));
    }
    for (const gName of groupNames) {
        children.appendChild(renderGroupNode(groupsByName.get(gName), groupsByName, hostsByName, new Set()));
    }
    const hostsNode = hostsSection(hostNames, hostsByName);
    if (hostsNode) children.appendChild(hostsNode);

    details.appendChild(children);
    return details;
}

function renderGroupNode(group, groupsByName, hostsByName, path) {
    if (path.has(group.name)) {
        return el("div", { class: "tree-leaf" }, [
            el("span", { class: "tree-badge tree-badge-group", text: "G" }),
            el("span", { class: "tree-name", text: group.name }),
            el("span", { class: "tree-warn", text: "circular reference — stopped here" }),
        ]);
    }
    const nextPath = new Set(path);
    nextPath.add(group.name);

    const { hostNames, groupNames } = splitMembers(group.members, hostsByName, groupsByName);
    const summaryMeta = `${groupNames.length} subgroup${groupNames.length === 1 ? "" : "s"} · ${hostNames.length} host${hostNames.length === 1 ? "" : "s"}`;

    const details = el("details", { class: "tree-node", open: true });
    details.appendChild(el("summary", { class: "tree-row" }, [
        chevron(),
        el("span", { class: "tree-badge tree-badge-group", text: "G" }),
        el("span", { class: "tree-name", text: group.name }),
        el("span", { class: "tree-trailing" }, [el("span", { class: "tree-meta", text: summaryMeta })]),
    ]));

    const children = el("div", { class: "tree-children" });
    if ((group.members || []).length === 0) {
        children.appendChild(el("p", { class: "inv-empty", text: "No members yet." }));
    }
    for (const sub of groupNames) {
        children.appendChild(renderGroupNode(groupsByName.get(sub), groupsByName, hostsByName, nextPath));
    }
    const hostsNode = hostsSection(hostNames, hostsByName);
    if (hostsNode) children.appendChild(hostsNode);

    details.appendChild(children);
    return details;
}

/** Renders the whole hierarchy tab. Registered with core's onRender(). */
export function renderTree() {
    const container = document.getElementById("tree-view");
    container.innerHTML = "";

    const hostsByName = byName(state.hosts);
    const groupsByName = byName(state.groups);

    if (state.roots.length === 0 && state.groups.length === 0 && state.hosts.length === 0) {
        container.appendChild(renderEmptyBlock("Nothing here yet.", "Add a host, group it, then attach the group to a root point from the other tabs."));
        return;
    }

    // A group/host referenced by something else doesn't need its own
    // top-level entry in the hierarchy - it'll show up nested under
    // whatever references it.
    const referencedGroups = new Set();
    const referencedHosts = new Set();
    for (const group of state.groups) {
        const { hostNames, groupNames } = splitMembers(group.members, hostsByName, groupsByName);
        hostNames.forEach((h) => referencedHosts.add(h));
        groupNames.forEach((g) => referencedGroups.add(g));
    }
    for (const root of state.roots) {
        const { hostNames, groupNames } = splitMembers(root.members, hostsByName, groupsByName);
        hostNames.forEach((h) => referencedHosts.add(h));
        groupNames.forEach((g) => referencedGroups.add(g));
    }

    if (state.roots.length > 0) {
        container.appendChild(el("p", { class: "tree-section-label", text: "Root points" }));
        for (const root of state.roots) {
            container.appendChild(renderRootNode(root, groupsByName, hostsByName));
        }
    }

    const orphanGroups = state.groups.filter((g) => !referencedGroups.has(g.name));
    if (orphanGroups.length > 0) {
        container.appendChild(el("p", { class: "tree-section-label", text: "Not attached to a root" }));
        for (const group of orphanGroups) {
            container.appendChild(renderGroupNode(group, groupsByName, hostsByName, new Set()));
        }
    }

    const unassignedHosts = state.hosts.filter((h) => !referencedHosts.has(h.name));
    if (unassignedHosts.length > 0) {
        container.appendChild(el("p", { class: "tree-section-label", text: "Unassigned hosts" }));
        const wrap = el("div", { class: "resolve-list" });
        for (const h of unassignedHosts) {
            wrap.appendChild(el("span", { class: "chip", text: h.address ? `${h.name} · ${h.address}` : h.name }));
        }
        container.appendChild(wrap);
    }
}
