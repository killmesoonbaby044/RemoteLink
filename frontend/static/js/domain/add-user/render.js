// Pure rendering for the Add user page - no fetching, no localStorage
// writes. main.js owns the `schema` state and decides when to call
// these; it also owns which row is "active" for the OU modal.

import { escapeHtml } from "../schema/render.js";

let rowCounter = 0;

export function createRow(dom) {
    const fragment = dom.rowTemplate.content.cloneNode(true);
    const row = fragment.querySelector("[data-row]");
    row.dataset.rowId = String(++rowCounter);
    dom.rowsContainer.appendChild(fragment);
    return row;
}

export function removeRow(row) {
    row.remove();
}

export function getRowFields(row) {
    return {
        fullNameInput: row.querySelector(".add-user-full-name"),
        usernameInput: row.querySelector(".add-user-username"),
        ouBtn: row.querySelector(".add-user-ou-btn"),
        ouChosen: row.querySelector(".add-user-ou-chosen"),
        ouHint: row.querySelector(".add-user-ou-hint"),
        status: row.querySelector(".add-user-row-status"),
    };
}

export function setRowOu(row, { name, dn }) {
    row.dataset.ouDn = dn;
    row.dataset.ouName = name;

    const { ouChosen, ouBtn } = getRowFields(row);
    ouChosen.textContent = name;
    ouChosen.title = dn;
    ouChosen.hidden = false;
    ouBtn.textContent = "Change OU…";
}

export function clearRow(row) {
    const { fullNameInput, usernameInput, ouChosen, ouBtn, ouHint } = getRowFields(row);
    fullNameInput.value = "";
    usernameInput.value = "";
    delete row.dataset.ouDn;
    delete row.dataset.ouName;
    ouChosen.hidden = true;
    ouChosen.textContent = "";
    ouBtn.textContent = "Choose OU…";
    ouHint.hidden = true;
    ouHint.textContent = "";
    setRowStatus(row, "");
}

export function isRowEmpty(row) {
    const { fullNameInput, usernameInput } = getRowFields(row);
    return !fullNameInput.value.trim() && !usernameInput.value.trim() && !row.dataset.ouDn;
}

// Pre-fills a row from one parsed upload record. `ou_hint` is shown as
// a plain note next to the OU button - it is NOT a DN and never sets
// row.dataset.ouDn, so the row still fails submit validation until
// someone picks the real OU by hand through the modal.
export function fillRowFromUpload(row, { full_name, username, ou_hint }) {
    const { fullNameInput, usernameInput, ouHint } = getRowFields(row);
    fullNameInput.value = full_name || "";
    usernameInput.value = username || "";

    if (ou_hint) {
        ouHint.textContent = `OU hint: ${ou_hint}`;
        ouHint.hidden = false;
    } else {
        ouHint.hidden = true;
        ouHint.textContent = "";
    }
}

export function setRowStatus(row, message, kind) {
    const { status } = getRowFields(row);
    status.hidden = !message;
    status.textContent = message || "";
    status.classList.remove("is-error", "is-success");
    if (kind) {
        status.classList.add(kind === "error" ? "is-error" : "is-success");
    }
}

export function readRow(row) {
    const { fullNameInput, usernameInput } = getRowFields(row);
    return {
        row,
        full_name: fullNameInput.value.trim(),
        username: usernameInput.value.trim(),
        org_unit_dn: row.dataset.ouDn || "",
    };
}

// ---- OU picker modal ----

function ouMatchesFilter(entry, query) {
    if (!query) return true;
    const name = (entry.Name || "").toLowerCase();
    const dn = (entry.DN || "").toLowerCase();
    return name.includes(query) || dn.includes(query);
}

// `schema` is the same shape domain/schema renders:
// { [rootName]: [{ Name, DN }, ...] }. The modal is two views over it:
// a root-key list first, then (once one is picked) that root's OU
// entries - see renderRootList / renderOuList below. Search behaves
// differently per view (main.js decides which to call): at the root
// view it searches every record across every root (renderGlobalOuSearch),
// while drilled into one root it only searches that root (renderOuList).
// Neither ever leaves `dom.modalGroups` empty-but-shrunk: a "no match"
// message fills the same space an empty result would otherwise leave
// blank (the box itself has a fixed height in CSS so it doesn't resize).

export function renderRootList(dom, schema) {
    const rootNames = Object.keys(schema || {});

    if (!rootNames.length) {
        dom.modalGroups.innerHTML = `<div class="ou-modal-empty">No roots are configured for this domain.</div>`;
        return;
    }

    dom.modalGroups.innerHTML = `
        <div class="ou-root-list">
            ${rootNames.map((rootName) => {
                const count = Array.isArray(schema[rootName]) ? schema[rootName].length : 0;
                return `
                    <button type="button" class="ou-root-btn" data-root="${escapeHtml(rootName)}">
                        <span class="ou-root-name">${escapeHtml(rootName)}</span>
                        <span class="ou-root-count">${count}</span>
                    </button>
                `;
            }).join("")}
        </div>
    `;
}

// Root view + a non-empty query: search every record under every root
// key, not just root names, and group matches by the root they came
// from so it's still clear which root each result belongs to.
export function renderGlobalOuSearch(dom, schema, query) {
    const rootNames = Object.keys(schema || {});
    const q = (query || "").trim().toLowerCase();

    const sections = rootNames.map((rootName) => {
        const entries = Array.isArray(schema[rootName]) ? schema[rootName] : [];
        const visible = entries.filter((entry) => ouMatchesFilter(entry, q));

        if (!visible.length) {
            return "";
        }

        return `
            <section class="ou-group">
                <h3 class="ou-group-name">${escapeHtml(rootName)}</h3>
                <div class="ou-group-rows">
                    ${visible.map((entry) => `
                        <button
                            type="button"
                            class="ou-row"
                            data-dn="${escapeHtml(entry.DN)}"
                            data-name="${escapeHtml(entry.Name)}"
                        >
                            <span class="ou-row-name">${escapeHtml(entry.Name)}</span>
                            <span class="ou-row-dn">${escapeHtml(entry.DN)}</span>
                        </button>
                    `).join("")}
                </div>
            </section>
        `;
    }).filter(Boolean);

    dom.modalGroups.innerHTML = sections.length
        ? sections.join("")
        : `<div class="ou-modal-empty">Nothing matches “${escapeHtml((query || "").trim())}” in any root.</div>`;
}

// Drilled into one root: search only that root's entries.
export function renderOuList(dom, schema, rootName, query) {
    const entries = Array.isArray((schema || {})[rootName]) ? schema[rootName] : [];

    if (!entries.length) {
        dom.modalGroups.innerHTML = `<div class="ou-modal-empty">No organizational units found under ${escapeHtml(rootName)}.</div>`;
        return;
    }

    const q = (query || "").trim().toLowerCase();
    const visible = entries.filter((entry) => ouMatchesFilter(entry, q));

    if (!visible.length) {
        dom.modalGroups.innerHTML = `<div class="ou-modal-empty">Nothing matches “${escapeHtml((query || "").trim())}” under ${escapeHtml(rootName)}.</div>`;
        return;
    }

    dom.modalGroups.innerHTML = `
        <div class="ou-group-rows">
            ${visible.map((entry) => `
                <button
                    type="button"
                    class="ou-row"
                    data-dn="${escapeHtml(entry.DN)}"
                    data-name="${escapeHtml(entry.Name)}"
                >
                    <span class="ou-row-name">${escapeHtml(entry.Name)}</span>
                    <span class="ou-row-dn">${escapeHtml(entry.DN)}</span>
                </button>
            `).join("")}
        </div>
    `;
}

export function renderRecentOus(dom, recent) {
    if (!recent.length) {
        dom.modalRecentBlock.hidden = true;
        dom.modalRecentList.innerHTML = "";
        return;
    }

    dom.modalRecentBlock.hidden = false;
    dom.modalRecentList.innerHTML = recent.map((item) => `
        <button
            type="button"
            class="ou-recent-chip"
            data-dn="${escapeHtml(item.dn)}"
            data-name="${escapeHtml(item.name)}"
            title="${escapeHtml(item.dn)}"
        >
            ${escapeHtml(item.name)}
        </button>
    `).join("");
}
