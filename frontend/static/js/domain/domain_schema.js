// domain_schema.js
// Fetches /domain/scripts/get_schema and renders the flat per-root
// OU lists it returns. The payload has no fixed set of root keys and
// no hierarchy — each root is an independent flat array of
// { Name, DN } pairs. Rows are always keyed by DN, never by Name,
// since Name is a derived display string and is not guaranteed unique.
//
// "Sync Schema" POSTs to the same endpoint to trigger a fresh scan on
// the backend; on a 200 response it reloads the table via the normal
// GET. It's laid out at the opposite end of the toolbar from the
// filter input so it doesn't read as a search action.

const page = document.querySelector(".schema-page");

if (page) {
    const endpoint = page.dataset.endpoint;
    const groupsEl = document.getElementById("schema-groups");
    const bannerEl = document.getElementById("schema-banner");
    const filterInput = document.getElementById("schema-filter");
    const syncBtn = document.getElementById("schema-sync");
    const syncLabel = syncBtn.querySelector(".schema-sync-label");
    const syncLabelDefault = syncLabel.textContent;

    let schema = null; // last successfully loaded payload: { [rootName]: [{Name, DN}, ...] }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value == null ? "" : String(value);
        return div.innerHTML;
    }

    function showBanner(message, retryHandler) {
        bannerEl.innerHTML = `
            <span>${escapeHtml(message)}</span>
            <button type="button" class="schema-banner-retry">Try again</button>
        `;
        bannerEl.hidden = false;
        bannerEl.querySelector(".schema-banner-retry").addEventListener("click", retryHandler, { once: true });
    }

    function hideBanner() {
        bannerEl.hidden = true;
        bannerEl.innerHTML = "";
    }

    function renderSkeleton() {
        groupsEl.innerHTML = Array.from({ length: 3 }).map(() => `
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

    function rowMatchesFilter(entry, query) {
        if (!query) return true;
        const name = (entry.Name || "").toLowerCase();
        const dn = (entry.DN || "").toLowerCase();
        return name.includes(query) || dn.includes(query);
    }

    function renderGroups() {
        if (!schema) return;

        const query = filterInput.value.trim().toLowerCase();
        const rootNames = Object.keys(schema);

        if (rootNames.length === 0) {
            groupsEl.innerHTML = `
                <div class="schema-group">
                    <div class="schema-empty">No roots are configured for this domain.</div>
                </div>
            `;
            return;
        }

        groupsEl.innerHTML = rootNames.map((rootName) => {
            const entries = Array.isArray(schema[rootName]) ? schema[rootName] : [];
            const visible = entries.filter((entry) => rowMatchesFilter(entry, query));

            let body;
            if (entries.length === 0) {
                body = `<div class="schema-empty">No organizational units found under ${escapeHtml(rootName)}.</div>`;
            } else if (visible.length === 0) {
                body = `<div class="schema-empty">Nothing here matches “${escapeHtml(filterInput.value.trim())}”.</div>`;
            } else {
                body = `
                    <div class="schema-rows">
                        ${visible.map((entry) => `
                            <div class="schema-row" data-dn="${escapeHtml(entry.DN)}">
                                <span class="schema-row-name">${escapeHtml(entry.Name)}</span>
                                <span class="schema-row-dn" title="${escapeHtml(entry.DN)}">${escapeHtml(entry.DN)}</span>
                                <button type="button" class="schema-row-copy" data-copy="${escapeHtml(entry.DN)}">Copy DN</button>
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

    async function loadSchema() {
        hideBanner();
        renderSkeleton();

        try {
            const response = await fetch(endpoint, {
                headers: { Accept: "application/json" },
            });

            if (!response.ok) {
                throw new Error(`Request failed (${response.status})`);
            }

            const data = await response.json();

            if (!data || typeof data !== "object" || Array.isArray(data)) {
                throw new Error("Unexpected response shape");
            }

            schema = data;
            renderGroups();
        } catch (err) {
            schema = null;
            groupsEl.innerHTML = "";
            showBanner("Couldn't load the domain schema. Check your connection and try again.", loadSchema);
            console.error("domain_schema: failed to load schema", err);
        }
    }

    async function syncSchema() {
        hideBanner();
        syncBtn.disabled = true;
        syncBtn.classList.add("is-syncing");
        syncLabel.textContent = "Syncing…";

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { Accept: "application/json" },
            });

            if (response.status === 200) {
                await loadSchema();
            } else {
                throw new Error(`Sync failed (${response.status})`);
            }
        } catch (err) {
            showBanner("Couldn't sync the domain schema. Check your connection and try again.", syncSchema);
            console.error("domain_schema: failed to sync schema", err);
        } finally {
            syncBtn.disabled = false;
            syncBtn.classList.remove("is-syncing");
            syncLabel.textContent = syncLabelDefault;
        }
    }

    groupsEl.addEventListener("click", async (event) => {
        const btn = event.target.closest(".schema-row-copy");
        if (!btn) return;

        const dn = btn.dataset.copy;
        try {
            await navigator.clipboard.writeText(dn);
            const original = btn.textContent;
            btn.textContent = "Copied";
            btn.classList.add("is-copied");
            setTimeout(() => {
                btn.textContent = original;
                btn.classList.remove("is-copied");
            }, 1200);
        } catch (err) {
            console.error("domain_schema: clipboard copy failed", err);
        }
    });

    let filterTimer = null;
    filterInput.addEventListener("input", () => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(renderGroups, 100);
    });

    syncBtn.addEventListener("click", syncSchema);

    loadSchema();
}