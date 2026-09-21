/**
 * Shared state + generic DOM/UI helpers.
 *
 * This is the second (and last) "shared" file - everything in here is
 * used by both records.js (hosts/groups/root points) and hierarchy.js
 * (the read-only tree). Feature-specific rendering stays out of this
 * file on purpose.
 */

import { api } from "./api.js";

/** In-memory state, reloaded from the API after every mutation. */
export const state = {
    hosts: [],
    groups: [],
    roots: [],
    resolveCache: {}, // "group:name" | "root:name" -> [hostNames]
};

export function byName(list) {
    const map = new Map();
    for (const item of list) map.set(item.name, item);
    return map;
}

export function el(tag, attrs, children) {
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
export function splitMembers(members, hostsByName, groupsByName) {
    const hostNames = [];
    const groupNames = [];
    for (const m of members || []) {
        if (hostsByName.has(m)) hostNames.push(m);
        else if (groupsByName.has(m)) groupNames.push(m);
        else hostNames.push(m); // unknown - surfaced as "not found" wherever it's rendered
    }
    return { hostNames, groupNames };
}

export function toast(message, isError) {
    const stack = document.getElementById("toast-stack");
    const node = el("div", { class: "toast" + (isError ? " is-error" : ""), text: message });
    stack.appendChild(node);
    setTimeout(() => node.remove(), 4000);
}

export function showBanner(message) {
    const banner = document.getElementById("inv-banner");
    banner.textContent = message;
    banner.classList.remove("is-hidden");
    banner.classList.add("is-error");
}

export function hideBanner() {
    document.getElementById("inv-banner").classList.add("is-hidden");
}

/** Empty-state block shared by the tables and the hierarchy view.
 *  `action`, if given, is an already-built element (e.g. a "+ New host"
 *  button) appended under the message - pass nothing for a read-only view. */
export function renderEmptyBlock(title, body, action) {
    const block = el("div", { class: "inv-empty-block" }, [
        el("p", { text: title + " " + body }),
    ]);
    if (action) block.appendChild(action);
    return block;
}

// ---------------------------------------------------------------
// Refresh orchestration
// ---------------------------------------------------------------
// records.js and hierarchy.js each register a render function here
// instead of importing each other, so there's a single load -> render
// pipeline with no circular imports between feature modules.

const renderers = [];

/** Register a `() => void` to run after every successful refresh. */
export function onRender(fn) {
    renderers.push(fn);
}

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

export async function refresh() {
    try {
        await loadAll();
        hideBanner();
        renderers.forEach((fn) => fn());
    } catch (err) {
        showBanner(`Couldn't load the inventory: ${err.message}`);
    }
}
