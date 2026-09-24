/**
 * Hosts / Groups / Root points: the three flat tables plus the shared
 * create+edit modal and delete flow. This is the one place mutations
 * happen - the hierarchy tab (hierarchy.js) is read-only and never calls
 * into any of this.
 */

import {api, SCHEMA} from "./api.js";
import {byName, el, refresh, renderEmptyBlock, splitMembers, state, toast} from "./core.js";

// ---------------------------------------------------------------
// Stats
// ---------------------------------------------------------------

function renderStats() {
    document.getElementById("stat-roots").textContent = state.roots.length;
    document.getElementById("stat-groups").textContent = state.groups.length;
    document.getElementById("stat-hosts").textContent = state.hosts.length;
}

// ---------------------------------------------------------------
// Table search / filter
// ---------------------------------------------------------------
// One free-text query per table, kept here (not in core state) since it's
// pure UI filtering over already-loaded records - it doesn't survive a
// refresh() re-fetch on purpose... actually it does: `filters` lives at
// module scope, so it's untouched by refresh() and only cleared if the
// user clears the box themselves.

const filters = { root: "", group: "", host: "" };

function matchesFilter(type, item) {
    const q = filters[type];
    if (!q) return true;
    const haystack = [item.name, item.address, item.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return haystack.includes(q);
}

/** Wires the three table search inputs. Call once at startup - the inputs
 *  are static markup, not re-rendered, so this doesn't need to run again
 *  after every refresh(). Each input re-renders only its own table. */
export function setupSearchInputs() {
    const wiring = [
        ["search-roots", "root", renderRootsTable],
        ["search-groups", "group", renderGroupsTable],
        ["search-hosts", "host", renderHostsTable],
    ];
    for (const [inputId, type, renderFn] of wiring) {
        const input = document.getElementById(inputId);
        if (!input) continue;
        input.addEventListener("input", () => {
            filters[type] = input.value.trim().toLowerCase();
            renderFn();
        });
    }
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
    return el("td", { title: members.join(", ") }, [
        el("span", { text: parts.join(", ") }),
    ]);
}

function emptyRow(type, title, body) {
    const button = el("button", {
        class: "btn btn-primary btn-sm",
        type: "button",
        text: `+ New ${SCHEMA[type].label}`,
        onclick: () => openModal(type, null),
    });
    return renderEmptyBlock(title, body, button);
}

function renderRootsTable() {
    const tbody = document.getElementById("table-roots");
    tbody.innerHTML = "";
    if (state.roots.length === 0) {
        tbody.appendChild(el("tr", {}, [
            el("td", { colspan: "4" }, [emptyRow("root", "No root points yet.", "Add one to gather groups and hosts under it, like a building or a site.")]),
        ]));
        return;
    }
    const filtered = state.roots.filter((r) => matchesFilter("root", r));
    if (filtered.length === 0) {
        tbody.appendChild(el("tr", {}, [
            el("td", { colspan: "4" }, [renderEmptyBlock("No matches.", "Try a different search term.")]),
        ]));
        return;
    }
    const hostsByName = byName(state.hosts);
    const groupsByName = byName(state.groups);
    for (const root of filtered) {
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
            el("td", { colspan: "4" }, [emptyRow("group", "No groups yet.", "Groups collect hosts (and other groups) so a root point can reference them together.")]),
        ]));
        return;
    }
    const filtered = state.groups.filter((g) => matchesFilter("group", g));
    if (filtered.length === 0) {
        tbody.appendChild(el("tr", {}, [
            el("td", { colspan: "4" }, [renderEmptyBlock("No matches.", "Try a different search term.")]),
        ]));
        return;
    }
    const hostsByName = byName(state.hosts);
    const groupsByName = byName(state.groups);
    for (const group of filtered) {
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
            el("td", { colspan: "5" }, [emptyRow("host", "No hosts yet.", "Add the switches you want to manage — you can group them afterwards.")]),
        ]));
        return;
    }
    const filtered = state.hosts.filter((h) => matchesFilter("host", h));
    if (filtered.length === 0) {
        tbody.appendChild(el("tr", {}, [
            el("td", { colspan: "5" }, [renderEmptyBlock("No matches.", "Try a different search term.")]),
        ]));
        return;
    }
    for (const host of filtered) {
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
        wrap.appendChild(buildMembersBox(field.key, type, existing));
    }

    if (field.help) wrap.appendChild(el("span", { class: "field-help", text: field.help }));
    return wrap;
}

function byNameAsc(a, b) {
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** Builds the "what can be added" picker used by the root point / group
 *  create+edit modal: a search box up top to cut down a long list, and
 *  the existing Groups / Hosts sections below it (sorted A→Z so the
 *  search actually helps). Filtering just hides rows - it never removes
 *  them from the DOM, so collectPayload()'s checked-checkbox query still
 *  sees every selection regardless of what's currently filtered out. */
function buildMembersBox(fieldKey, type, existing) {
    const wrapper = el("div", { class: "members-field" });
    const box = el("div", { class: "multiselect", id: `f-${fieldKey}` });
    const selected = new Set((existing && existing[fieldKey]) || []);

    const hostOptions = [...state.hosts].sort(byNameAsc);
    const groupOptions = state.groups
        .filter((g) => !(type === "group" && existing && g.name === existing.name))
        .sort(byNameAsc);

    if (hostOptions.length === 0 && groupOptions.length === 0) {
        box.appendChild(el("div", { class: "multiselect-empty", text: "No hosts or groups exist yet." }));
        wrapper.appendChild(box);
        return wrapper;
    }

    let groupHeading = null;
    let hostHeading = null;
    const groupRows = [];
    const hostRows = [];

    if (groupOptions.length > 0) {
        groupHeading = el("div", { class: "multiselect-heading", text: "Groups" });
        box.appendChild(groupHeading);
        for (const g of groupOptions) {
            const row = memberCheckbox(fieldKey, g.name, selected);
            groupRows.push(row);
            box.appendChild(row);
        }
    }
    if (hostOptions.length > 0) {
        hostHeading = el("div", { class: "multiselect-heading", text: "Hosts" });
        box.appendChild(hostHeading);
        for (const h of hostOptions) {
            const row = memberCheckbox(fieldKey, h.name, selected);
            hostRows.push(row);
            box.appendChild(row);
        }
    }

    const noMatches = el("div", { class: "multiselect-empty is-hidden", text: "No matches." });
    box.appendChild(noMatches);

    const searchInput = el("input", {
        type: "search",
        class: "search-input multiselect-search",
        placeholder: "Filter hosts and groups…",
        autocomplete: "off",
    });
    searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        let groupVisible = 0;
        let hostVisible = 0;
        for (const row of groupRows) {
            const match = row.textContent.toLowerCase().includes(q);
            row.style.display = match ? "" : "none";
            if (match) groupVisible++;
        }
        for (const row of hostRows) {
            const match = row.textContent.toLowerCase().includes(q);
            row.style.display = match ? "" : "none";
            if (match) hostVisible++;
        }
        if (groupHeading) groupHeading.classList.toggle("is-hidden", groupVisible === 0);
        if (hostHeading) hostHeading.classList.toggle("is-hidden", hostVisible === 0);
        noMatches.classList.toggle("is-hidden", groupVisible + hostVisible > 0);
    });

    wrapper.appendChild(searchInput);
    wrapper.appendChild(box);
    return wrapper;
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
// Public API
// ---------------------------------------------------------------

/** Renders stats + all three tables. Registered with core's onRender(). */
export function renderRecords() {
    renderStats();
    renderRootsTable();
    renderGroupsTable();
    renderHostsTable();
}

export function setupModalChrome() {
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
