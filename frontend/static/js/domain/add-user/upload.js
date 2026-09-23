// Owns the "Upload file" button on the Add user page: opens the
// hidden file input, sends whatever's picked to the backend for
// parsing, and pre-fills rows from the result.
//
// Deliberately its own file rather than folded into main.js - the
// upload flow has its own state (busy/idle) and enough steps (pick a
// file, existing-empty-row reuse, new-row creation, per-record hint
// rendering) to be worth keeping separate. Takes the row-management
// pieces it needs from main.js via `rows` rather than importing
// main.js, since main.js is the one thing that should own wiring.
//
// `rows` is:
//   - getRows(): current row elements, in DOM order
//   - addRow(): creates + binds a new row, returns it
// `render` is the subset of render.js this file calls (isRowEmpty,
// fillRowFromUpload) - injected the same way so this module has no
// hidden coupling to how a row's internals are queried.

import { uploadUsersFile } from "./api.js";

export function initUpload(dom, { getRows, addRow }, { isRowEmpty, fillRowFromUpload }) {
    if (!dom.uploadBtn || !dom.uploadInput) {
        return;
    }

    dom.uploadBtn.addEventListener("click", () => {
        dom.uploadInput.click();
    });

    dom.uploadInput.addEventListener("change", async () => {
        const file = dom.uploadInput.files && dom.uploadInput.files[0];
        dom.uploadInput.value = ""; // allow picking the same file again later

        if (!file) {
            return;
        }

        dom.uploadBtn.disabled = true;
        dom.uploadBtn.textContent = "Uploading…";
        dom.summary.hidden = true;

        try {
            const { users, errors } = await uploadUsersFile(dom.uploadEndpoint, file);
            applyParsedUsers(users, { getRows, addRow }, { isRowEmpty, fillRowFromUpload });
            showUploadSummary(dom, users.length, errors);
        } catch (err) {
            dom.summary.hidden = false;
            dom.summary.textContent = err.message || "Upload failed.";
            console.error("domain/add-user: upload failed", err);
        } finally {
            dom.uploadBtn.disabled = false;
            dom.uploadBtn.textContent = "Upload file";
        }
    });
}

// Reuses existing empty rows first (in DOM order), then creates new
// ones for whatever's left over - so uploading into a page that
// already has a couple of rows started doesn't leave stray blanks.
function applyParsedUsers(users, { getRows, addRow }, { isRowEmpty, fillRowFromUpload }) {
    const emptyRows = getRows().filter(isRowEmpty);
    let emptyIndex = 0;

    users.forEach((user) => {
        const row = emptyIndex < emptyRows.length ? emptyRows[emptyIndex++] : addRow();
        fillRowFromUpload(row, user);
    });
}

function showUploadSummary(dom, importedCount, errors) {
    dom.summary.hidden = false;

    const parts = [
        importedCount
            ? `Imported ${importedCount} row${importedCount === 1 ? "" : "s"} from the file.`
            : "No rows were imported from that file.",
    ];

    if (errors.length) {
        parts.push(`${errors.length} row${errors.length === 1 ? "" : "s"} couldn't be parsed: ${errors.map((e) => e.message).join("; ")}`);
    }

    dom.summary.textContent = parts.join(" ");
}
