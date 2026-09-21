/**
 * Network layer for the domain schema page.
 *
 * Owns the two requests to `endpoint` (the same URL for both — GET
 * reads the last scan, POST triggers a fresh one) and the response
 * shape check. No DOM, no rendering.
 */

export async function fetchSchema(endpoint) {
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

    // { [rootName]: [{ Name, DN }, ...] }
    return data;
}

export async function syncSchema(endpoint) {
    const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
    });

    if (response.status !== 200) {
        throw new Error(`Sync failed (${response.status})`);
    }
}
