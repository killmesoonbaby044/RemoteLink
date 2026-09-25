// Entry point for the Add user page (templates/pages/domain_add_user.html).
// Holds the mutable state (loaded schema, which row the OU modal is
// currently editing) and is the only place that wires up event
// listeners, per the module-shape convention (see README.md).

import {fetchOuSchema, submitUser} from "./api.js";
import {getAddUserDom} from "./dom.js";
import {getRecentOus, pushRecentOu} from "./ou-history.js";
import {initUpload} from "./upload.js";
import {
    clearRow,
    createRow,
    fillRowFromUpload,
    getRowFields,
    isRowEmpty,
    markRowAdded,
    readRow,
    removeRow,
    renderGlobalOuSearch,
    renderOuList,
    renderRecentOus,
    renderRootList,
    setRowOu,
    setRowStatus,
} from "./render.js";

const dom = getAddUserDom();

if (dom) {
    let schema = null; // last successfully loaded { [rootName]: [{Name, DN}] }
    let schemaLoadPromise = null;
    let activeRow = null; // the row the OU modal is currently choosing for
    let filterTimer = null;

    // Modal has two views: "roots" (root keys only) and "ou-list"
    // (one root's entries, reachable via the back button).
    let viewState = "roots";
    let currentRoot = null;

    function ensureSchema() {
        if (schema) {
            return Promise.resolve(schema);
        }

        if (schemaLoadPromise) {
            return schemaLoadPromise;
        }

        dom.modalStatus.textContent = "Loading organizational units…";

        schemaLoadPromise = fetchOuSchema(dom.schemaEndpoint)
            .then((data) => {
                schema = data;
                dom.modalStatus.textContent = "";
                return schema;
            })
            .catch((err) => {
                schemaLoadPromise = null;
                dom.modalStatus.textContent = "Couldn't load organizational units. Check your connection and try again.";
                console.error("domain/add-user: failed to load schema", err);
                throw err;
            });

        return schemaLoadPromise;
    }

    // ---- OU modal ----

    function showRoots(query = "") {
        viewState = "roots";
        currentRoot = null;
        dom.modalBack.hidden = true;
        dom.modalTitle.textContent = "Choose organizational unit";
        dom.modalFilter.placeholder = "Search all organizational units";

        const trimmed = (query || "").trim();

        ensureSchema()
            .then((data) => {
                if (trimmed) {
                    // Root view + a query searches every record under
                    // every root, not just root names.
                    renderGlobalOuSearch(dom, data, trimmed);
                } else {
                    renderRootList(dom, data);
                }
            })
            .catch(() => {
                // Banner already shown via modalStatus above.
            });
    }

    function showOuList(rootName, query = "") {
        viewState = "ou-list";
        currentRoot = rootName;
        dom.modalBack.hidden = false;
        dom.modalTitle.textContent = rootName;
        dom.modalFilter.placeholder = "Filter by name or DN";

        ensureSchema()
            .then((data) => renderOuList(dom, data, rootName, query))
            .catch(() => {});
    }

    function openModalFor(row) {
        activeRow = row;
        dom.modalFilter.value = "";
        renderRecentOus(dom, getRecentOus());
        dom.modalOverlay.hidden = false;
        dom.modalFilter.focus();
        showRoots();
    }

    function closeModal() {
        dom.modalOverlay.hidden = true;
        activeRow = null;
    }

    function selectOu({ name, dn }) {
        if (!activeRow) {
            return;
        }

        setRowOu(activeRow, { name, dn });
        pushRecentOu({ name, dn });
        closeModal();
    }

    dom.modalClose.addEventListener("click", closeModal);

    dom.modalBack.addEventListener("click", () => {
        dom.modalFilter.value = "";
        showRoots();
    });

    dom.modalOverlay.addEventListener("click", (event) => {
        if (event.target === dom.modalOverlay) {
            closeModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !dom.modalOverlay.hidden) {
            closeModal();
        }
    });

    dom.modalFilter.addEventListener("input", () => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => {
            if (viewState === "roots") {
                showRoots(dom.modalFilter.value);
            } else {
                showOuList(currentRoot, dom.modalFilter.value);
            }
        }, 100);
    });

    dom.modalGroups.addEventListener("click", (event) => {
        const rootBtn = event.target.closest(".ou-root-btn");
        if (rootBtn) {
            dom.modalFilter.value = "";
            showOuList(rootBtn.dataset.root);
            return;
        }

        const ouBtn = event.target.closest(".ou-row");
        if (ouBtn) {
            selectOu({ name: ouBtn.dataset.name, dn: ouBtn.dataset.dn });
        }
    });

    dom.modalRecentList.addEventListener("click", (event) => {
        const btn = event.target.closest(".ou-recent-chip");
        if (!btn) return;
        selectOu({ name: btn.dataset.name, dn: btn.dataset.dn });
    });

    // ---- Rows ----

    function bindRow(row) {
        const { ouBtn } = getRowFields(row);

        ouBtn.addEventListener("click", () => openModalFor(row));

        row.querySelector(".add-user-row-remove").addEventListener("click", () => {
            const rows = dom.rowsContainer.querySelectorAll("[data-row]");

            if (rows.length <= 1) {
                // Always keep at least one row - clear it instead of
                // removing it entirely.
                clearRow(row);
                return;
            }

            removeRow(row);
        });

        return row;
    }

    function addRow() {
        return bindRow(createRow(dom));
    }

    dom.addRowBtn.addEventListener("click", () => addRow());

    initUpload(
        dom,
        {
            getRows: () => Array.from(dom.rowsContainer.querySelectorAll("[data-row]")),
            addRow,
        },
        { isRowEmpty, fillRowFromUpload },
    );

    // ---- Submit ----
    // The endpoint takes one user record at a time, so multiple rows
    // are submitted as one sequential POST per row (not a batch
    // request) - each row gets its own success/fail status.

    async function handleSubmit() {
        const rows = Array.from(dom.rowsContainer.querySelectorAll("[data-row]"));
        const entries = rows.map(readRow);
        const withData = entries.filter((e) => e.full_name || e.username || e.org_unit_dn);

        if (!withData.length) {
            dom.summary.hidden = false;
            dom.summary.textContent = "Fill in at least one row before submitting.";
            return;
        }

        // Rows that already succeeded on a previous click must not be
        // sent to the API again - only resubmit new/failed rows.
        const usable = withData.filter((e) => e.row.dataset.userAdded !== "true");

        if (!usable.length) {
            dom.summary.hidden = false;
            dom.summary.textContent = "All users already added.";
            return;
        }

        dom.submitBtn.disabled = true;
        dom.summary.hidden = true;

        let ok = 0;
        let failed = 0;

        for (const entry of usable) {
            if (!entry.full_name || !entry.username || !entry.org_unit_dn) {
                setRowStatus(entry.row, "Fill in full name, username, and OU.", "error");
                failed += 1;
                continue;
            }

            setRowStatus(entry.row, "Adding…", null);

            try {
                await submitUser(dom.submitEndpoint, entry);
                setRowStatus(entry.row, "Added.", "success");
                markRowAdded(entry.row);
                ok += 1;
            } catch (err) {
                setRowStatus(entry.row, err.message || "Failed to add user.", "error");
                failed += 1;
                console.error("domain/add-user: failed to add user", err);
            }
        }

        dom.submitBtn.disabled = false;
        dom.summary.hidden = false;
        dom.summary.textContent = failed
            ? `${ok} added, ${failed} failed — see row status for details.`
            : `${ok} user${ok === 1 ? "" : "s"} added.`;
    }

    dom.submitBtn.addEventListener("click", handleSubmit);

    // Start with one row.
    addRow();
}
