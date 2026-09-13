/**
 * Switch inventory page — talks to the /inventory/* API in
 * switch_inventory.py, backed by InventoryStore (inventory.py).
 *
 * SCHEMA
 * ------
 *   Host       { name, address, port, description }  (address/port/
 *                description are a guess - schemas.py wasn't seen -
 *                see the `host` entry in SCHEMA below to adjust them)
 *   Group      { name, members: [hostOrGroupName...] }
 *   RootPoint  { name, members: [hostOrGroupName...] }
 *
 * A group or root point's `members` list mixes host names and group
 * names together - there's no separate "hosts" vs "groups" field.
 * Every render/form function below reads member names and figures out
 * whether each one is a host or a group by checking `state.hosts` /
 * `state.groups`, exactly like the backend does.
 */

(function () {
    "use strict";

    const API_BASE = "/inventory";

    const SCHEMA = {
        host: {
            label: "host",
            endpoint: "/hosts",
            fields: [
                { key: "name", label: "Name", type: "text", required: true,
                  help: "Unique identifier for this host." },
                { key: "address", label: "IP address / hostname", type: "text", required: true },
                { key: "port", label: "Port", type: "number", required: false, placeholder: "22" },
                { key: "description", label: "Description", type: "text", required: false },
            ],
        },
        group: {
            label: "group",
            endpoint: "/groups",
            fields: [
                { key: "name", label: "Name", type: "text", required: true },
                { key: "members", label: "Members", type: "members", required: false,
                  help: "Hosts and/or other groups. Groups can nest inside groups." },
            ],
        },
        root: {
            label: "root point",
            endpoint: "/root-points",
            fields: [
                { key: "name", label: "Name", type: "text", required: true },
                { key: "members", label: "Members", type: "members", required: false,
                  help: "The hosts and groups that belong to this root point." },
            ],
        },
    };

    /** In-memory state, reloaded from the API after every mutation. */
    const state = {
        hosts: [],
        groups: [],
        roots: [],
        resolveCache: {}, // "group:name" | "root:name" -> [hostNames]
    };

    // ---------------------------------------------------------------
    // API
    // ---------------------------------------------------------------

    async function apiRequest(path, options) {
        const res = await fetch(API_BASE + path, {
            headers: { "Content-Type": "application/json" },
            ...options,
        });
        if (!res.ok) {
            let detail = res.statusText;
            try {
                const body = await res.json();
                if (body && body.detail) detail = body.detail;
            } catch (_) { /* no json body */ }
            throw new Error(detail || `Request failed (${res.status})`);
        }
        if (res.status === 204) return null;
        return res.json();
    }

    // Only groups and root points have members; hosts don't, so
    // there's no "host" entry here.
    const MEMBER_PATH = {
        group: (name, member) => `/groups/${encodeURIComponent(name)}/members/${encodeURIComponent(member)}`,
        root: (name, member) => `/root-points/${encodeURIComponent(name)}/members/${encodeURIComponent(member)}`,
    };

    const api = {
        list: (type) => apiRequest(SCHEMA[type].endpoint, { method: "GET" }),
        create: (type, payload) => apiRequest(SCHEMA[type].endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
        }),
        update: (type, name, payload) => apiRequest(`${SCHEMA[type].endpoint}/${encodeURIComponent(name)}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        }),
        remove: (type, name) => apiRequest(`${SCHEMA[type].endpoint}/${encodeURIComponent(name)}`, {
            method: "DELETE",
        }),
        resolve: (type, name) => apiRequest(`${SCHEMA[type].endpoint}/${encodeURIComponent(name)}/resolve`, {
            method: "GET",
        }),
        addMember: (parentType, parentName, memberName) => apiRequest(
            MEMBER_PATH[parentType](parentName, memberName), { method: "POST" },
        ),
        removeMember: (parentType, parentName, memberName) => apiRequest(
            MEMBER_PATH[parentType](parentName, memberName), { method: "DELETE" },
        ),
    };

    async function loadAll() {
        const [hosts, groups, roots] = await Promise.all([
            api.list("host"),
            api.list("group"),
            api.list("root"),
        ]);
        state.hosts = hosts || [];
        state.groups = groups || [];
        state.roots = roots || [];
        state.resolveCache = {};
    }

    // ---------------------------------------------------------------
    // Small helpers
    // ---------------------------------------------------------------

    function byName(list) {
        const map = new Map();
        for (const item of list) map.set(item.name, item);
        return map;
    }

    function el(tag, attrs, children) {
        const node = document.createElement(tag);
        if (attrs) {
            for (const [k, v] of Object.entries(attrs)) {
                if (k === "class") node.className = v;
                else if (k === "text") node.textContent = v;
                else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
                else if (v === true) node.setAttribute(k, "");
                else if (v !== false && v != null) node.setAttribute(k, v);
            }
        }
        for (const child of children || []) {
            if (child == null) continue;
            node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
        }
        return node;
    }

    /** Splits a mixed members list into { hostNames, groupNames }. */
    function splitMembers(members, hostsByName, groupsByName) {
        const hostNames = [];
        const groupNames = [];
        for (const m of members || []) {
            if (hostsByName.has(m)) hostNames.push(m);
            else if (groupsByName.has(m)) groupNames.push(m);
            else hostNames.push(m); // unknown - surfaced as "not found" wherever it's rendered
        }
        return { hostNames, groupNames };
    }

    // ---------------------------------------------------------------
    // Toasts + banner
    // ---------------------------------------------------------------

    function toast(message, isError) {
        const stack = document.getElementById("toast-stack");
        const node = el("div", { class: "toast" + (isError ? " is-error" : ""), text: message });
        stack.appendChild(node);
        setTimeout(() => node.remove(), 4000);
    }

    function showBanner(message) {
        const banner = document.getElementById("inv-banner");
        banner.textContent = message;
        banner.classList.remove("is-hidden");
        banner.classList.add("is-error");
    }

    function hideBanner() {
        document.getElementById("inv-banner").classList.add("is-hidden");
    }

    // ---------------------------------------------------------------
    // Stats
    // ---------------------------------------------------------------

    function renderStats() {
        document.getElementById("stat-roots").textContent = state.roots.length;
        document.getElementById("stat-groups").textContent = state.groups.length;
        document.getElementById("stat-hosts").textContent = state.hosts.length;
    }

    // ---------------------------------------------------------------
    // Tables
    // ---------------------------------------------------------------

    function actionButtons(type, item) {
        const wrap = el("div", { class: "cell-actions" });
        wrap.appendChild(el("button", {
            class: "btn btn-sm",
            type: "button",
            text: "Edit",
            onclick: () => openModal(type, item),
        }));
        wrap.appendChild(el("button", {
            class: "btn btn-sm btn-danger",
            type: "button",
            text: "Delete",
            onclick: () => handleDelete(type, item.name),
        }));
        return wrap;
    }

    function resolveCountCell(type, name) {
        const cacheKey = `${type}:${name}`;
        const td = el("td", {});
        const btn = el("button", {
            class: "resolve-count",
            type: "button",
            text: state.resolveCache[cacheKey] ? `${state.resolveCache[cacheKey].length} hosts` : "resolve →",
        });
        const list = el("div", { class: "resolve-list", style: "display:none" });

        btn.addEventListener("click", async () => {
            if (list.style.display === "flex") {
                list.style.display = "none";
                return;
            }
            if (!state.resolveCache[cacheKey]) {
                btn.textContent = "resolving…";
                try {
                    const hosts = await api.resolve(type, name);
                    state.resolveCache[cacheKey] = hosts.map((h) => h.name);
                    list.innerHTML = "";
                    if (hosts.length === 0) {
                        list.appendChild(el("span", { class: "cell-muted", text: "No hosts resolve here." }));
                    } else {
                        for (const h of hosts) list.appendChild(el("span", { class: "chip", text: h.name }));
                    }
                } catch (err) {
                    toast(`Couldn't resolve ${name}: ${err.message}`, true);
                    btn.textContent = "resolve →";
                    return;
                }
            }
            btn.textContent = `${state.resolveCache[cacheKey].length} hosts`;
            list.style.display = "flex";
        });

        td.appendChild(btn);
        td.appendChild(list);
        return td;
    }

    function membersSummaryCell(members, hostsByName, groupsByName) {
        if (!members || members.length === 0) return el("td", { class: "cell-muted", text: "—" });
        const { hostNames, groupNames } = splitMembers(members, hostsByName, groupsByName);
        const parts = [];
        if (groupNames.length) parts.push(`${groupNames.length} group${groupNames.length === 1 ? "" : "s"}`);
        if (hostNames.length) parts.push(`${hostNames.length} host${hostNames.length === 1 ? "" : "s"}`);
        const td = el("td", { title: members.join(", ") }, [
            el("span", { text: parts.join(", ") }),
        ]);
        return td;
    }

    function renderRootsTable() {
        const tbody = document.getElementById("table-roots");
        tbody.innerHTML = "";
        if (state.roots.length === 0) {
            tbody.appendChild(el("tr", {}, [
                el("td", { colspan: "4" }, [emptyBlock("root", "No root points yet.", "Add one to gather groups and hosts under it, like a building or a site.")]),
            ]));
            return;
        }
        const hostsByName = byName(state.hosts);
        const groupsByName = byName(state.groups);
        for (const root of state.roots) {
            const tr = el("tr", {}, [
                el("td", { class: "cell-name", text: root.name }),
                membersSummaryCell(root.members, hostsByName, groupsByName),
            ]);
            tr.appendChild(resolveCountCell("root", root.name));
            tr.appendChild(el("td", {}, [actionButtons("root", root)]));
            tbody.appendChild(tr);
        }
    }

    function renderGroupsTable() {
        const tbody = document.getElementById("table-groups");
        tbody.innerHTML = "";
        if (state.groups.length === 0) {
            tbody.appendChild(el("tr", {}, [
                el("td", { colspan: "4" }, [emptyBlock("group", "No groups yet.", "Groups collect hosts (and other groups) so a root point can reference them together.")]),
            ]));
            return;
        }
        const hostsByName = byName(state.hosts);
        const groupsByName = byName(state.groups);
        for (const group of state.groups) {
            const tr = el("tr", {}, [
                el("td", { class: "cell-name", text: group.name }),
                membersSummaryCell(group.members, hostsByName, groupsByName),
            ]);
            tr.appendChild(resolveCountCell("group", group.name));
            tr.appendChild(el("td", {}, [actionButtons("group", group)]));
            tbody.appendChild(tr);
        }
    }

    function renderHostsTable() {
        const tbody = document.getElementById("table-hosts");
        tbody.innerHTML = "";
        if (state.hosts.length === 0) {
            tbody.appendChild(el("tr", {}, [
                el("td", { colspan: "5" }, [emptyBlock("host", "No hosts yet.", "Add the switches you want to manage — you can group them afterwards.")]),
            ]));
            return;
        }
        for (const host of state.hosts) {
            const tr = el("tr", {}, [
                el("td", { class: "cell-name", text: host.name }),
                el("td", { class: "cell-name", text: host.address || "—" }),
                el("td", { class: "cell-muted", text: host.port != null ? host.port : "—" }),
                el("td", { class: "cell-muted", text: host.description || "—" }),
            ]);
            tr.appendChild(el("td", {}, [actionButtons("host", host)]));
            tbody.appendChild(tr);
        }
    }

    function emptyBlock(type, title, body) {
        const block = el("div", { class: "inv-empty-block" }, [
            el("p", { text: title + " " + body }),
        ]);
        block.appendChild(el("button", {
            class: "btn btn-primary btn-sm",
            type: "button",
            text: `+ New ${SCHEMA[type].label}`,
            onclick: () => openModal(type, null),
        }));
        return block;
    }

    // ---------------------------------------------------------------
    // Hierarchy tree
    // ---------------------------------------------------------------

    function renderTree() {
        const container = document.getElementById("tree-view");
        container.innerHTML = "";

        const hostsByName = byName(state.hosts);
        const groupsByName = byName(state.groups);

        if (state.roots.length === 0 && state.groups.length === 0 && state.hosts.length === 0) {
            container.appendChild(emptyBlock("host", "Nothing here yet.", "Add a host, group it, then attach the group to a root point."));
            return;
        }

        // A group/host referenced by something else doesn't need its
        // own top-level entry in the hierarchy - it'll show up nested
        // under whatever references it.
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

    /** "×" button that detaches a member from its parent (doesn't
     * delete the member itself) and refreshes on success. */
    function detachButton(parentType, parentName, memberName) {
        return el("button", {
            class: "tree-detach",
            type: "button",
            title: `Remove ${memberName} from ${parentName}`,
            "aria-label": `Remove ${memberName} from ${parentName}`,
            text: "×",
            onclick: async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    await api.removeMember(parentType, parentName, memberName);
                    toast(`Removed ${memberName} from ${parentName}.`);
                    await refresh();
                } catch (err) {
                    toast(`Couldn't remove ${memberName}: ${err.message}`, true);
                }
            },
        });
    }

    /** Inline "attach a member" row at the bottom of a node's children,
     * offering hosts and groups not already attached. */
    function attachRow(parentType, parentName, currentMembers) {
        const taken = new Set(currentMembers || []);
        const options = [];
        for (const h of state.hosts) {
            if (!taken.has(h.name)) options.push({ name: h.name, kind: "host" });
        }
        for (const g of state.groups) {
            if (parentType === "group" && g.name === parentName) continue; // no self-subgroup
            if (!taken.has(g.name)) options.push({ name: g.name, kind: "group" });
        }
        if (options.length === 0) {
            return el("p", { class: "inv-empty", text: "Everything available is already attached." });
        }
        const select = el("select", { class: "tree-add-select" });
        for (const opt of options) {
            select.appendChild(el("option", { value: opt.name, text: `${opt.name} (${opt.kind})` }));
        }
        const button = el("button", {
            class: "btn btn-sm",
            type: "button",
            text: "+ Add member",
            onclick: async () => {
                const memberName = select.value;
                try {
                    await api.addMember(parentType, parentName, memberName);
                    toast(`Added ${memberName} to ${parentName}.`);
                    await refresh();
                } catch (err) {
                    toast(`Couldn't add ${memberName}: ${err.message}`, true);
                }
            },
        });
        return el("div", { class: "tree-add-row" }, [select, button]);
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
            children.appendChild(renderGroupNode(
                groupsByName.get(gName), groupsByName, hostsByName, new Set(),
                { parentType: "root", parentName: root.name },
            ));
        }
        for (const hName of hostNames) {
            children.appendChild(hostLeaf(
                hName, hostsByName, { parentType: "root", parentName: root.name },
            ));
        }

        children.appendChild(attachRow("root", root.name, root.members));
        details.appendChild(children);
        return details;
    }

    function renderGroupNode(group, groupsByName, hostsByName, path, removeCtx) {
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

        const trailing = [el("span", { class: "tree-meta", text: summaryMeta })];
        if (removeCtx) {
            trailing.push(detachButton(removeCtx.parentType, removeCtx.parentName, group.name));
        }

        const details = el("details", { class: "tree-node", open: true });
        details.appendChild(el("summary", { class: "tree-row" }, [
            chevron(),
            el("span", { class: "tree-badge tree-badge-group", text: "G" }),
            el("span", { class: "tree-name", text: group.name }),
            el("span", { class: "tree-trailing" }, trailing),
        ]));

        const children = el("div", { class: "tree-children" });
        if ((group.members || []).length === 0) {
            children.appendChild(el("p", { class: "inv-empty", text: "No members yet." }));
        }
        for (const sub of groupNames) {
            children.appendChild(renderGroupNode(
                groupsByName.get(sub), groupsByName, hostsByName, nextPath,
                { parentType: "group", parentName: group.name },
            ));
        }
        for (const hName of hostNames) {
            children.appendChild(hostLeaf(hName, hostsByName, { parentType: "group", parentName: group.name }));
        }

        children.appendChild(attachRow("group", group.name, group.members));
        details.appendChild(children);
        return details;
    }

    function hostLeaf(hostName, hostsByName, removeCtx) {
        const host = hostsByName.get(hostName);
        const trailing = [];
        if (host && host.address) trailing.push(el("span", { class: "tree-meta", text: host.address }));
        else if (!host) trailing.push(el("span", { class: "tree-warn", text: "not found" }));
        if (removeCtx) trailing.push(detachButton(removeCtx.parentType, removeCtx.parentName, hostName));
        return el("div", { class: "tree-leaf" }, [
            el("span", { class: "tree-badge tree-badge-host", text: "H" }),
            el("span", { class: "tree-name", text: hostName }),
            el("span", { class: "tree-trailing" }, trailing),
        ]);
    }

    function chevron() {
        const span = document.createElement("span");
        span.className = "tree-chevron";
        span.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3l5 5-5 5"/></svg>';
        return span;
    }

    // ---------------------------------------------------------------
    // Render-everything
    // ---------------------------------------------------------------

    function renderAll() {
        renderStats();
        renderRootsTable();
        renderGroupsTable();
        renderHostsTable();
        renderTree();
    }

    async function refresh() {
        try {
            await loadAll();
            hideBanner();
            renderAll();
        } catch (err) {
            showBanner(`Couldn't load the inventory: ${err.message}`);
        }
    }

    // ---------------------------------------------------------------
    // Tabs
    // ---------------------------------------------------------------

    function setupTabs() {
        const tabs = document.querySelectorAll(".inv-tab");
        const panels = document.querySelectorAll(".inv-panel");
        tabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                tabs.forEach((t) => {
                    t.classList.remove("is-active");
                    t.setAttribute("aria-selected", "false");
                });
                tab.classList.add("is-active");
                tab.setAttribute("aria-selected", "true");
                panels.forEach((p) => p.classList.remove("is-active"));
                document.querySelector(`.inv-panel[data-panel="${tab.dataset.tab}"]`).classList.add("is-active");
            });
        });
    }

    // ---------------------------------------------------------------
    // Modal / create+edit form
    // ---------------------------------------------------------------

    function buildFieldRow(type, field, existing, isEdit) {
        const wrap = el("div", { class: "field" });
        wrap.appendChild(el("label", { for: `f-${field.key}`, text: field.label + (field.required ? "" : " (optional)") }));

        if (field.type === "text" || field.type === "number") {
            const input = el("input", {
                id: `f-${field.key}`,
                name: field.key,
                type: field.type,
                placeholder: field.placeholder || "",
            });
            if (field.required) input.required = true;
            if (existing && existing[field.key] != null) input.value = existing[field.key];
            // Renaming isn't supported by the API - lock the name field
            // once editing rather than let the user type a new one.
            if (isEdit && field.key === "name") {
                input.disabled = true;
                wrap.appendChild(input);
                wrap.appendChild(el("span", { class: "field-help", text: "Renaming isn't supported — delete this and create a new one instead." }));
                return wrap;
            }
            wrap.appendChild(input);
        } else if (field.type === "members") {
            const box = buildMembersBox(field.key, type, existing);
            wrap.appendChild(box);
        }

        if (field.help) wrap.appendChild(el("span", { class: "field-help", text: field.help }));
        return wrap;
    }

    function buildMembersBox(fieldKey, type, existing) {
        const box = el("div", { class: "multiselect", id: `f-${fieldKey}` });
        const selected = new Set((existing && existing[fieldKey]) || []);

        const hostOptions = state.hosts;
        const groupOptions = state.groups.filter((g) => !(type === "group" && existing && g.name === existing.name));

        if (hostOptions.length === 0 && groupOptions.length === 0) {
            box.appendChild(el("div", { class: "multiselect-empty", text: "No hosts or groups exist yet." }));
            return box;
        }

        if (groupOptions.length > 0) {
            box.appendChild(el("div", { class: "multiselect-heading", text: "Groups" }));
            for (const g of groupOptions) box.appendChild(memberCheckbox(fieldKey, g.name, selected));
        }
        if (hostOptions.length > 0) {
            box.appendChild(el("div", { class: "multiselect-heading", text: "Hosts" }));
            for (const h of hostOptions) box.appendChild(memberCheckbox(fieldKey, h.name, selected));
        }
        return box;
    }

    function memberCheckbox(fieldKey, name, selectedSet) {
        const label = el("label", {});
        const checkbox = el("input", { type: "checkbox", value: name, name: fieldKey });
        if (selectedSet.has(name)) checkbox.checked = true;
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(name));
        return label;
    }

    function collectPayload(type, form, isEdit, originalName) {
        const schema = SCHEMA[type];
        const payload = {};
        for (const field of schema.fields) {
            if (field.key === "name" && isEdit) {
                payload.name = originalName;
                continue;
            }
            if (field.type === "members") {
                const checked = form.querySelectorAll(`input[name="${field.key}"]:checked`);
                payload[field.key] = Array.from(checked).map((c) => c.value);
            } else if (field.type === "number") {
                const input = form.querySelector(`[name="${field.key}"]`);
                if (input.value !== "") payload[field.key] = Number(input.value);
            } else {
                const input = form.querySelector(`[name="${field.key}"]`);
                if (input.value !== "") payload[field.key] = input.value;
                else if (field.required) payload[field.key] = "";
            }
        }
        return payload;
    }

    function openModal(type, existing) {
        const schema = SCHEMA[type];
        const isEdit = Boolean(existing);
        const originalName = isEdit ? existing.name : null;

        document.getElementById("modal-title").textContent = isEdit
            ? `Edit ${schema.label}: ${existing.name}`
            : `New ${schema.label}`;

        const errorBox = document.getElementById("modal-error");
        errorBox.classList.add("is-hidden");
        errorBox.textContent = "";

        const form = document.getElementById("modal-form");
        form.innerHTML = "";
        for (const field of schema.fields) {
            form.appendChild(buildFieldRow(type, field, existing, isEdit));
        }

        const actions = el("div", { class: "modal-actions" }, [
            el("button", { type: "button", class: "btn btn-ghost", text: "Cancel", onclick: closeModal }),
            el("button", { type: "submit", class: "btn btn-primary", text: isEdit ? "Save changes" : `Create ${schema.label}` }),
        ]);
        form.appendChild(actions);

        form.onsubmit = async (e) => {
            e.preventDefault();
            errorBox.classList.add("is-hidden");
            const payload = collectPayload(type, form, isEdit, originalName);
            try {
                if (isEdit) {
                    await api.update(type, originalName, payload);
                    toast(`Saved changes to "${originalName}".`);
                } else {
                    await api.create(type, payload);
                    toast(`Created ${schema.label} "${payload.name}".`);
                }
                closeModal();
                await refresh();
            } catch (err) {
                errorBox.textContent = err.message;
                errorBox.classList.remove("is-hidden");
            }
        };

        document.getElementById("modal-backdrop").classList.remove("is-hidden");
        const firstInput = form.querySelector("input:not([disabled])");
        if (firstInput) firstInput.focus();
    }

    function closeModal() {
        document.getElementById("modal-backdrop").classList.add("is-hidden");
    }

    async function handleDelete(type, name) {
        const schema = SCHEMA[type];
        const ok = window.confirm(`Delete ${schema.label} "${name}"? This can't be undone.`);
        if (!ok) return;
        try {
            await api.remove(type, name);
            toast(`Deleted ${schema.label} "${name}".`);
            await refresh();
        } catch (err) {
            toast(`Couldn't delete "${name}": ${err.message}`, true);
        }
    }

    // ---------------------------------------------------------------
    // Init
    // ---------------------------------------------------------------

    function setupModalChrome() {
        document.getElementById("modal-close").addEventListener("click", closeModal);
        document.getElementById("modal-backdrop").addEventListener("click", (e) => {
            if (e.target.id === "modal-backdrop") closeModal();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !document.getElementById("modal-backdrop").classList.contains("is-hidden")) {
                closeModal();
            }
        });
        document.querySelectorAll('[data-action="create"]').forEach((btn) => {
            btn.addEventListener("click", () => openModal(btn.dataset.type, null));
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        setupTabs();
        setupModalChrome();
        refresh();
    });
})();