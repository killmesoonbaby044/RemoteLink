/**
 * Hierarchy tab - read only.
 *
 * This view is for understanding the tree, not editing it: no attach/
 * detach controls here at all. To change membership, edit a group or
 * root point from its table (the Groups / Root points tabs), which goes
 * through the normal create+edit modal.
 *
 * Default expand state: root points render expanded, so their direct
 * groups show up by name as soon as you land on the tab - that's the
 * "roots and their groups" view. Every group node - nested or not -
 * renders collapsed: click one to reveal what's inside it, subgroups
 * and hosts together, by real name, in a single step. There's no
 * separate "hosts" toggle to click through first.
 *
 * The "Expand all" / "Collapse all" toolbar buttons (wired in
 * setupTreeControls()) override this per-node default for the whole
 * tree at once. That same function also makes sure manual clicks don't
 * "stick" past a collapse: closing any node resets everything nested
 * inside it back to collapsed, so reopening it always shows the same
 * default view rather than remembering a group you'd expanded earlier.
 */

import {byName, el, renderEmptyBlock, splitMembers, state} from "./core.js";

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

/** Appends each host directly as a leaf row into `children` - no
 *  wrapping "Hosts" toggle. Hosts are full members just like subgroups,
 *  so they show up the same way: as soon as their parent group/root is
 *  open, by name, not hidden behind a second click on a generic label. */
function appendHostLeaves(children, hostNames, hostsByName) {
    for (const hName of hostNames) children.appendChild(hostLeaf(hName, hostsByName));
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
    appendHostLeaves(children, hostNames, hostsByName);

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

    // No "open: true" here on purpose - a group's own toggle is what
    // keeps its hosts collapsed by default. Root nodes stay expanded
    // (see renderRootNode) so a group's *name* is visible right away;
    // what's inside the group - subgroups and hosts alike - only shows
    // once this node itself is clicked open.
    const details = el("details", { class: "tree-node" });
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
    appendHostLeaves(children, hostNames, hostsByName);

    details.appendChild(children);
    return details;
}

/** Wires the "Expand all" / "Collapse all" toolbar buttons, plus the
 *  behavior that keeps manual expand/collapse clicks from "sticking":
 *  closing any tree node resets every node nested inside it back to
 *  collapsed, so collapsing then re-expanding a root always lands back
 *  on the same default view, not on whatever a group inside it was
 *  last left at. A plain <details> keeps its own open state even while
 *  hidden inside a closed ancestor - nothing clears that on its own.
 *
 *  Call once at startup - the buttons are static markup, and the
 *  listener below is delegated to #tree-view, which renderTree() only
 *  ever clears the *contents* of, never the element itself, so neither
 *  needs rewiring after a refresh(). */
export function setupTreeControls() {
    const expandBtn = document.getElementById("tree-expand-all");
    const collapseBtn = document.getElementById("tree-collapse-all");
    if (expandBtn) {
        expandBtn.addEventListener("click", () => {
            document.querySelectorAll("#tree-view details.tree-node").forEach((d) => { d.open = true; });
        });
    }
    if (collapseBtn) {
        collapseBtn.addEventListener("click", () => {
            document.querySelectorAll("#tree-view details.tree-node").forEach((d) => { d.open = false; });
        });
    }

    // "toggle" doesn't bubble, so catching it from every nested node
    // with one listener means listening on the *capture* phase instead
    // - capture still reaches every descendant regardless of bubbling.
    const treeView = document.getElementById("tree-view");
    if (treeView) {
        treeView.addEventListener("toggle", (e) => {
            const node = e.target;
            if (node.tagName !== "DETAILS" || !node.classList.contains("tree-node") || node.open) return;
            node.querySelectorAll("details.tree-node").forEach((d) => { d.open = false; });
        }, true);
    }
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
