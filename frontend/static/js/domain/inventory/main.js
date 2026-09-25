// Entry point for the domain schema page (templates/pages/domain_schema.html).
// Was domain_schema.js as one file - split the same way as
// switch/inventory: api/dom/render here, this file just holds the
// `schema` state and wires everything together.

import {fetchSchema, syncSchema as syncSchemaRequest} from "./api.js";
import {getSchemaDom} from "./dom.js";
import {hideBanner, renderGroups, renderSkeleton, showBanner} from "./render.js";

const dom = getSchemaDom();

if (dom) {
    let schema = null; // last successfully loaded payload, see render.js

    async function loadSchema() {
        hideBanner(dom);
        renderSkeleton(dom);

        try {
            schema = await fetchSchema(dom.endpoint);
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
            console.error("domain/inventory/data: clipboard copy failed", err);
        }
    });

    let filterTimer = null;
    dom.filterInput.addEventListener("input", () => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => renderGroups(dom, schema), 100);
    });

    dom.syncBtn.addEventListener("click", handleSync);

    loadSchema();
}
