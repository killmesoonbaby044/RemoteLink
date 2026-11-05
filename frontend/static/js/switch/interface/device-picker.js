// Device picker for the interface-config page: the same root point ->
// group -> host tree as the inventory Hierarchy tab (css/shared/tree.css),
// but host leaves are buttons that pick that switch.
//
// Its own module rather than part of render.js because it keeps state
// (the loaded inventory, the search query, which host is selected) and
// swaps between two views: the tree, and a flat list of matches while a
// search query is typed. Wired from main.js like everything else; tells
// main.js about a pick through onPick(host).
//
// Default open state matches the Hierarchy tab: root points open so
// their groups are visible by name, groups closed until clicked.

const CHEVRON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3l5 5-5 5"/></svg>';

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function byName(list) {
    return new Map(list.map((item) => [item.name, item]));
}

function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function createDevicePicker({ container, filterInput, statusEl, expandButton, collapseButton, onPick }) {
    let hostsByName = new Map();
    let groupsByName = new Map();
    let roots = [];
    let selected = null;

    // host name -> every "Root / Group / Subgroup" path it sits under,
    // shown next to search matches so same-looking names can be told apart.
    let hostPaths = new Map();

    function split(members) {
        const hosts = [];
        const groups = [];
        for (const name of members || []) {
            if (groupsByName.has(name)) groups.push(name);
            else hosts.push(name);
        }
        return { hosts: hosts.sort(), groups: groups.sort() };
    }

    function indexPaths() {
        hostPaths = new Map();
        const add = (host, path) => {
            if (!hostPaths.has(host)) hostPaths.set(host, []);
            hostPaths.get(host).push(path.join(" / "));
        };
        const walk = (members, path, seen) => {
            const { hosts, groups } = split(members);
            hosts.forEach((h) => add(h, path));
            for (const g of groups) {
                if (seen.has(g)) continue;
                walk(groupsByName.get(g).members, [...path, g], new Set([...seen, g]));
            }
        };
        roots.forEach((root) => walk(root.members, [root.name], new Set()));
        // groups not under any root (or any other group) still give their hosts a path
        orphanGroups().forEach((group) => walk(group.members, [group.name], new Set([group.name])));
    }

    function referencedNames() {
        const hosts = new Set();
        const groups = new Set();
        for (const item of [...roots, ...groupsByName.values()]) {
            const members = split(item.members);
            members.hosts.forEach((h) => hosts.add(h));
            members.groups.forEach((g) => groups.add(g));
        }
        return { hosts, groups };
    }

    function orphanGroups() {
        const { groups } = referencedNames();
        return [...groupsByName.values()].filter((g) => !groups.has(g.name));
    }

    function hostLeaf(name, meta) {
        const host = hostsByName.get(name);
        const leaf = el("button", "tree-leaf iface-tree-host");
        leaf.type = "button";
        leaf.dataset.host = name;
        leaf.classList.toggle("is-selected", name === selected);

        const badge = el("span", "tree-badge tree-badge-host", "H");
        const label = el("span", "tree-name", name);
        const trailing = el("span", "tree-trailing");
        if (meta) trailing.append(el("span", "tree-meta iface-tree-path", meta));
        trailing.append(host
            ? el("span", "tree-meta", host.address)
            : el("span", "tree-warn", "not found"));

        leaf.append(badge, label, trailing);
        if (host) leaf.addEventListener("click", () => pick(name));
        else leaf.disabled = true;
        return leaf;
    }

    function node(kind, name, members, path, open) {
        const { hosts, groups } = split(members);
        const details = el("details", "tree-node");
        details.open = open;

        const summary = el("summary", "tree-row");
        const chevron = el("span", "tree-chevron");
        chevron.innerHTML = CHEVRON;
        const meta = kind === "root"
            ? `${plural(groups.length, "group")} · ${plural(hosts.length, "host")}`
            : `${plural(groups.length, "subgroup")} · ${plural(hosts.length, "host")}`;
        const trailing = el("span", "tree-trailing");
        trailing.append(el("span", "tree-meta", meta));
        summary.append(
            chevron,
            el("span", `tree-badge tree-badge-${kind}`, kind === "root" ? "R" : "G"),
            el("span", "tree-name", name),
            trailing,
        );
        details.append(summary);

        const children = el("div", "tree-children");
        for (const g of groups) {
            if (path.has(g)) continue; // cycle guard, same as the Hierarchy tab
            children.append(node("group", g, groupsByName.get(g).members, new Set([...path, g]), false));
        }
        hosts.forEach((h) => children.append(hostLeaf(h)));
        if (!groups.length && !hosts.length) children.append(el("p", "iface-hint", "Empty."));
        details.append(children);
        return details;
    }

    function renderTree() {
        container.innerHTML = "";

        if (roots.length) {
            container.append(el("p", "tree-section-label", "Root points"));
            roots.forEach((root) => container.append(node("root", root.name, root.members, new Set(), true)));
        }

        const orphans = orphanGroups();
        if (orphans.length) {
            container.append(el("p", "tree-section-label", "Not attached to a root"));
            orphans.forEach((g) => container.append(node("group", g.name, g.members, new Set([g.name]), false)));
        }

        const referenced = referencedNames().hosts;
        const unassigned = [...hostsByName.keys()].filter((h) => !referenced.has(h)).sort();
        if (unassigned.length) {
            container.append(el("p", "tree-section-label", "Unassigned hosts"));
            unassigned.forEach((h) => container.append(hostLeaf(h)));
        }
    }

    // While searching: one flat list of matching hosts with where each
    // sits in the tree, instead of making the user open groups to find it.
    function renderMatches(query) {
        container.innerHTML = "";
        const q = query.toLowerCase();
        const matches = [...hostsByName.values()]
            .filter((h) => h.name.toLowerCase().includes(q) || h.address.toLowerCase().includes(q))
            .sort((a, b) => a.name.localeCompare(b.name));

        if (!matches.length) {
            container.append(el("p", "lookup-empty", "No switch matches."));
            return;
        }
        container.append(el("p", "tree-section-label", matches.length === 1 ? "1 match" : `${matches.length} matches`));
        for (const host of matches) {
            container.append(hostLeaf(host.name, (hostPaths.get(host.name) || ["Unassigned"]).join(", ")));
        }
    }

    function render() {
        const query = filterInput.value.trim();
        expandButton.disabled = collapseButton.disabled = Boolean(query);
        if (query) renderMatches(query);
        else renderTree();
    }

    function pick(name) {
        selected = name;
        container.querySelectorAll(".iface-tree-host").forEach((leaf) => {
            leaf.classList.toggle("is-selected", leaf.dataset.host === name);
        });
        onPick(hostsByName.get(name));
    }

    async function load(fetchInventory) {
        try {
            const inventory = await fetchInventory();
            hostsByName = byName(inventory.hosts);
            groupsByName = byName(inventory.groups);
            roots = inventory.roots.slice().sort((a, b) => a.name.localeCompare(b.name));
            indexPaths();

            if (!hostsByName.size) {
                statusEl.textContent = "No hosts in your inventory yet.";
                filterInput.disabled = true;
                return;
            }
            statusEl.textContent = "";
            statusEl.hidden = true;
            render();
        } catch (err) {
            statusEl.textContent = `Failed to load inventory: ${err.message}`;
            statusEl.classList.add("lookup-error");
        }
    }

    filterInput.addEventListener("input", render);

    // Enter in the search box picks the match when there's exactly one.
    filterInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const leaves = container.querySelectorAll(".iface-tree-host:not(:disabled)");
        if (leaves.length === 1) pick(leaves[0].dataset.host);
        else leaves[0]?.focus();
    });

    expandButton.addEventListener("click", () => {
        container.querySelectorAll("details.tree-node").forEach((d) => { d.open = true; });
    });
    collapseButton.addEventListener("click", () => {
        container.querySelectorAll("details.tree-node").forEach((d) => { d.open = false; });
    });

    // Closing a node resets everything inside it, so reopening shows the
    // default view (same behavior as the Hierarchy tab).
    container.addEventListener("toggle", (event) => {
        const details = event.target;
        if (details.tagName !== "DETAILS" || details.open) return;
        details.querySelectorAll("details.tree-node").forEach((d) => { d.open = false; });
    }, true);

    // Pick a host by name from outside (e.g. ?host= in the URL). Returns
    // false when it isn't in the inventory.
    function pickByName(name) {
        if (!hostsByName.has(name)) return false;
        pick(name);
        return true;
    }

    return { load, pick: pickByName, focus: () => filterInput.focus() };
}
