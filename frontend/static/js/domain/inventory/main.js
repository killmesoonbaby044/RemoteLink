// Entry point for the domain schema page (templates/pages/domain_schema.html).
// Was domain_schema.js as one file - split the same way as
// network/inventory: api/dom/render here, this file just holds the
// `schema` state and wires everything together.

import {fetchSchema, syncSchema as syncSchemaRequest} from "./api.js";
import {getSchemaDom} from "./dom.js";
import {hideBanner, renderGroups, renderSkeleton, showBanner} from "./render.js";
import {resetUsersState, retryUsers, toggleUsers} from "./users.js";

const dom = getSchemaDom();

if (dom) {
    let schema = null; // last successfully loaded payload, see render.js

    async function loadSchema() {
        hideBanner(dom);
        renderSkeleton(dom);

        try {
            schema = await fetchSchema(dom.endpoint);
            resetUsersState();
            renderGroups(dom, schema);
        } catch (err) {
            schema = null;
            dom.groups.innerHTML = "";
            showBanner(dom, "Couldn't load the domain schema. Check your connection and try again.", loadSchema);
            console.error("domain/inventory/data: failed to load schema", err);
        }
    }

    async function handleSync() {
        hideBanner(dom);
        dom.syncBtn.disabled = true;
        dom.syncBtn.classList.add("is-syncing");
        dom.syncLabel.textContent = "Syncing…";

        try {
            await syncSchemaRequest(dom.endpoint);
            await loadSchema();
        } catch (err) {
            showBanner(dom, "Couldn't sync the domain schema. Check your connection and try again.", handleSync);
            console.error("domain/inventory/data: failed to sync schema", err);
        } finally {
            dom.syncBtn.disabled = false;
            dom.syncBtn.classList.remove("is-syncing");
            dom.syncLabel.textContent = dom.syncLabelDefault;
        }
    }

    dom.groups.addEventListener("click", async (event) => {
        const usersBtn = event.target.closest(".schema-row-users");
        if (usersBtn) {
            await toggleUsers(usersBtn);
            return;
        }

        const retryBtn = event.target.closest(".schema-users-retry");
        if (retryBtn) {
            await retryUsers(retryBtn);
        }
    });

    let filterTimer = null;
    dom.filterInput.addEventListener("input", () => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => {
            resetUsersState();
            renderGroups(dom, schema);
        }, 100);
    });

    dom.syncBtn.addEventListener("click", handleSync);

    loadSchema();
}
