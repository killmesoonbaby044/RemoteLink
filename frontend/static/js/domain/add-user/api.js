/**
 * Network layer for the "Add user" page.
 *
 * Three requests: reuse the same schema shape as domain/inventory
 * ({ [rootName]: [{ Name, DN }, ...] }) to populate the OU picker, a
 * JSON POST per user record (the endpoint takes one record at a time,
 * not a batch - see main.js for how multiple rows are handled), and a
 * multipart file upload that comes back with pre-fill data for
 * multiple rows at once (see uploadUsersFile / upload.js).
 */

export async function fetchOuSchema(endpoint) {
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

    return data;
}

export async function submitUser(endpoint, { full_name, username, org_unit_dn }) {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({ full_name, username, org_unit_dn }),
    });

    let body = null;
    try {
        body = await response.json();
    } catch {
        // No/invalid JSON body - fall through with body = null.
    }

    if (!response.ok) {
        throw new Error((body && body.detail) || `Failed (${response.status})`);
    }

    return body;
}

// Bulk pre-fill: sends a document (CSV/Excel/whatever the backend
// parses) and gets back { users: [{full_name, username, ou_hint}],
// errors?: [{row, message}] }. `ou_hint` is free text, never a DN -
// see upload.js for why the OU still has to be picked by hand.
export async function uploadUsersFile(endpoint, file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
    });

    let body = null;
    try {
        body = await response.json();
    } catch {
        // No/invalid JSON body - fall through with body = null.
    }

    if (!response.ok) {
        throw new Error((body && body.detail) || `Upload failed (${response.status})`);
    }

    if (!body || !Array.isArray(body.users)) {
        throw new Error("Unexpected response shape from upload.");
    }

    return {
        users: body.users,
        errors: Array.isArray(body.errors) ? body.errors : [],
    };
}
