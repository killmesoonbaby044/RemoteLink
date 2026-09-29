// Pure rendering for the schema block - no fetching. Takes dom refs
// (from dom.js) and data in, draws it. main.js owns the `schema` state
// and decides when to call these.

export function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
}

function rowMatchesFilter(entry, query) {
    if (!query) return true;
    const name = (entry.Name || "").toLowerCase();
    const dn = (entry.DN || "").toLowerCase();
    return name.includes(query) || dn.includes(query);
}

export function showBanner(dom, message, retryHandler) {
    dom.banner.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button type="button" class="schema-banner-retry">Try again</button>
    `;
    dom.banner.hidden = false;
    dom.banner.querySelector(".schema-banner-retry").addEventListener("click", retryHandler, { once: true });
}

export function hideBanner(dom) {
    dom.banner.hidden = true;
    dom.banner.innerHTML = "";
}

export function renderSkeleton(dom) {
    dom.groups.innerHTML = Array.from({ length: 3 }).map(() => `
        <div class="schema-group">
            <div class="schema-group-head">
                <div class="schema-skeleton-row" style="height:14px;width:120px;border-top:none;flex:none;"></div>
            </div>
            <div class="schema-skeleton-row"></div>
            <div class="schema-skeleton-row"></div>
            <div class="schema-skeleton-row"></div>
        </div>
    `).join("");
}

// `schema` is the last successfully loaded payload:
// { [rootName]: [{ Name, DN }, ...] } - each root an independent flat
// array, rows always keyed by DN since Name isn't guaranteed unique.
export function renderGroups(dom, schema) {
    if (!schema) return;

    const query = dom.filterInput.value.trim().toLowerCase();
    const rootNames = Object.keys(schema);

    if (rootNames.length === 0) {
        dom.groups.innerHTML = `
            <div class="schema-group">
                <div class="schema-empty">No roots are configured for this domain.</div>
            </div>
        `;
        return;
    }

    dom.groups.innerHTML = rootNames.map((rootName) => {
        const entries = Array.isArray(schema[rootName]) ? schema[rootName] : [];
        const visible = entries.filter((entry) => rowMatchesFilter(entry, query));

        let body;
        if (entries.length === 0) {
            body = `<div class="schema-empty">No organizational units found under ${escapeHtml(rootName)}.</div>`;
        } else if (visible.length === 0) {
            body = `<div class="schema-empty">Nothing here matches “${escapeHtml(dom.filterInput.value.trim())}”.</div>`;
        } else {
            body = `
                <div class="schema-rows">
                    ${visible.map((entry) => `
                        <div class="schema-row-wrap">
                            <div class="schema-row" data-dn="${escapeHtml(entry.DN)}">
                                <span class="schema-row-name">${escapeHtml(entry.Name)}</span>
                                <span class="schema-row-dn" title="${escapeHtml(entry.DN)}">${escapeHtml(entry.DN)}</span>
                                <button type="button" class="schema-row-users" data-dn="${escapeHtml(entry.DN)}" aria-expanded="false">
                                    <span class="schema-row-users-caret" aria-hidden="true">&#9656;</span>
                                    Users
                                </button>
                            </div>
                            <div class="schema-users" hidden></div>
                        </div>
                    `).join("")}
                </div>
            `;
        }

        const countLabel = query
            ? `<span class="schema-group-count is-hidden-count">${visible.length} / ${entries.length}</span>`
            : `<span class="schema-group-count">${entries.length}</span>`;

        return `
            <section class="schema-group">
                <div class="schema-group-head">
                    <h2 class="schema-group-name">${escapeHtml(rootName)}</h2>
                    ${countLabel}
                </div>
                ${body}
            </section>
        `;
    }).join("");
}

// Pure render of one row's `.schema-users` subtable content. `container`
// is the `.schema-users` element itself (not replaced, just filled in) so
// users.js can toggle its `hidden` attribute independently of whatever's
// drawn inside it. Also stamps `container.dataset.status` so users.js can
// tell "already loaded, don't refetch" apart from "errored, retry on
// next open" without duplicating that bookkeeping itself.
//
// state: { status: "loading" } | { status: "error", message } | { status: "loaded", users }
// users: [{ login, full_name }, ...]
export function renderUsersState(container, state) {
    if (state.status === "loading") {
        container.dataset.status = "loading";
        container.innerHTML = `<div class="schema-users-loading">Loading users…</div>`;
        return;
    }

    if (state.status === "error") {
        container.dataset.status = "error";
        container.innerHTML = `
            <div class="schema-users-error">
                <span>${escapeHtml(state.message || "Couldn't load users.")}</span>
                <button type="button" class="schema-users-retry">Try again</button>
            </div>
        `;
        return;
    }

    container.dataset.status = "loaded";
    const users = Array.isArray(state.users) ? state.users : [];

    if (users.length === 0) {
        container.innerHTML = `<div class="schema-users-empty">No users found under this OU.</div>`;
        return;
    }

    container.innerHTML = `
        <table class="schema-users-table">
            <thead>
                <tr>
                    <th class="schema-users-col-login">Username</th>
                    <th class="schema-users-col-name">Full name</th>
                </tr>
            </thead>
            <tbody>
                ${users.map((user) => `
                    <tr>
                        <td class="schema-users-col-login">${escapeHtml(user.username)}</td>
                        <td class="schema-users-col-name">${escapeHtml(user.full_name)}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}
