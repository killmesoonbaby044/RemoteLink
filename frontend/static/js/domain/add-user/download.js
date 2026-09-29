// Owns the "Download credentials" button on the Add user page.
//
// Keeps a running list of every user successfully added during this
// page session - not just the last submit click. The submit endpoint
// only resends rows that aren't yet data-user-added="true" (see
// main.js), so a user can fix one bad row and press "Add users" again;
// this file's list has to survive that and keep everyone added so far,
// not just the latest batch. That's its own bit of state independent
// of any single row or submit call, so - same reasoning as upload.js -
// it gets its own file rather than living in main.js.

function pad(n) {
    return String(n).padStart(2, "0");
}

// Filename is <first successful row's OU name>_<day>_<month>.txt. The OU
// name is whatever setRowOu() (render.js) wrote into row.dataset.ouName /
// the .add-user-ou-chosen span when the OU was picked - same value, main.js
// just reads it off the row's dataset instead of re-querying the span.
// Sanitized since an OU name can contain characters a filename can't.
function sanitizeForFilename(name) {
    const cleaned = String(name || "")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "")
        .replace(/\s+/g, "_");

    return cleaned || "users";
}

function buildFilename(ouName) {
    const now = new Date();
    return `${sanitizeForFilename(ouName)}_${pad(now.getDate())}_${pad(now.getMonth() + 1)}.txt`;
}

export function initDownload(dom) {
    if (!dom.downloadBtn) {
        return { addSuccessfulUser() {} };
    }

    const added = []; // {username, password}, accumulated for the whole session
    let firstOuName = null; // OU of the first successful add - decides the filename

    dom.downloadBtn.addEventListener("click", () => {
        if (!added.length) {
            return;
        }

        const text = added.map(({ username, password }) => `${username} - ${password}`).join("\n");
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = buildFilename(firstOuName);
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    });

    return {
        addSuccessfulUser({ username, password, ouName }) {
            if (firstOuName === null) {
                firstOuName = ouName;
            }
            added.push({ username, password });
            dom.downloadBtn.disabled = false;
        },
    };
}

