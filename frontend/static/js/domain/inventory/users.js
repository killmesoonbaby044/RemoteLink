// "Show users under this OU" flow for a schema row.
//
// Fetches on first expand, caches the result in the row's own `.schema-users`
// element (via container.dataset.status, stamped by render.js), and toggles
// visibility on repeat clicks without refetching. Only one subtable stays
// open at a time - opening a new one collapses whichever was open before.
//
// This has its own per-row open/loaded state that doesn't fit render.js's
// "pure, no side effects" rule, so it's a separate module - same reason
// domain/add-user splits off upload.js. Wired from main.js, same as
// everything else: main.js owns the click delegation and calls into
// toggleUsers()/retryUsers() here.

import {fetchUsersForDn} from "./api.js";
import {USERS_ENDPOINT} from "./config.js";
import {renderUsersState} from "./render.js";

let openContainer = null;

function findTriggerBtn(container) {
    const wrap = container.closest(".schema-row-wrap");
    return wrap ? wrap.querySelector(".schema-row-users") : null;
}

function collapse(container) {
    container.hidden = true;
    const btn = findTriggerBtn(container);
    if (btn) {
        btn.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
    }
    if (openContainer === container) {
        openContainer = null;
    }
}

function expand(container, btn) {
    container.hidden = false;
    btn.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
}

async function loadUsers(container, dn) {
    renderUsersState(container, { status: "loading" });

    try {
        const users = await fetchUsersForDn(USERS_ENDPOINT, dn);
        renderUsersState(container, { status: "loaded", users });
    } catch (err) {
        renderUsersState(container, { status: "error", message: "Couldn't load users. Click to try again." });
        console.error("domain/inventory/users: failed to load users", err);
    }
}

// Called on click of a row's "Users" button (event delegated in main.js).
export async function toggleUsers(btn) {
    const wrap = btn.closest(".schema-row-wrap");
    const container = wrap ? wrap.querySelector(".schema-users") : null;
    if (!container) return;

    const alreadyOpen = openContainer === container && !container.hidden;

    // Same row, already open and not in an error state -> just collapse it.
    if (alreadyOpen && container.dataset.status !== "error") {
        collapse(container);
        return;
    }

    // A different row is open -> collapse it before opening this one.
    if (openContainer && openContainer !== container && !openContainer.hidden) {
        collapse(openContainer);
    }

    openContainer = container;
    expand(container, btn);

    // Already fetched successfully -> reuse the cached render, no refetch.
    if (container.dataset.status === "loaded") {
        return;
    }

    await loadUsers(container, btn.dataset.dn);
}

// Called on click of the "Try again" button inside an errored subtable
// (event delegated in main.js).
export async function retryUsers(retryBtn) {
    const container = retryBtn.closest(".schema-users");
    if (!container) return;

    const btn = findTriggerBtn(container);
    const dn = btn ? btn.dataset.dn : null;
    if (!dn) return;

    await loadUsers(container, dn);
}

// Called before the groups list is re-rendered (filter change, reload)
// since that innerHTML wipe destroys whatever DOM nodes openContainer
// was pointing at - stale reference otherwise.
export function resetUsersState() {
    openContainer = null;
}
