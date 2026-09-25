/**
 * Network layer for the switch inventory page.
 *
 * Owns:
 *  - the API base path
 *  - SCHEMA: per-type (host/group/root) field definitions, used both to
 *    build forms and to derive REST endpoints
 *  - apiRequest(): a fetch wrapper that turns FastAPI error bodies into a
 *    single readable string, whether they're a plain HTTPException
 *    ({"detail": "..."}) or a pydantic 422 validation error
 *    ({"detail": [{"loc": [...], "msg": "..."}]}). Passing the raw
 *    `detail` around used to end up as "[object Object]" wherever it hit
 *    a template string - formatErrorDetail() below is the fix.
 */

export const API_BASE = "/switch/inventory";

export const SCHEMA = {
    host: {
        label: "host",
        endpoint: "/hosts",
        fields: [
            { key: "name", label: "Name", type: "text", required: true,
              help: "Unique identifier for this host." },
            { key: "address", label: "IP address / hostname", type: "text", required: true },
            { key: "port", label: "Port", type: "number", required: false, placeholder: "22" },
            { key: "description", label: "Description", type: "text", required: false },
        ],
    },
    group: {
        label: "group",
        endpoint: "/groups",
        fields: [
            { key: "name", label: "Name", type: "text", required: true },
            { key: "members", label: "Members", type: "members", required: false,
              help: "Hosts and/or other groups. Groups can nest inside groups." },
        ],
    },
    root: {
        label: "root point",
        endpoint: "/root-points",
        fields: [
            { key: "name", label: "Name", type: "text", required: true },
            { key: "members", label: "Members", type: "members", required: false,
              help: "The hosts and groups that belong to this root point." },
        ],
    },
};

/** Turns a FastAPI error body into one readable string.
 *  - {"detail": "some string"}                       -> the string itself
 *  - {"detail": [{"loc": [...], "msg": "..."}, ...]}  -> "field: msg; field: msg"
 *  - anything else                                    -> falls back to `fallback` */
function formatErrorDetail(body, fallback) {
    const detail = body && body.detail;
    if (!detail) return fallback;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
        const parts = detail.map((e) => {
            if (typeof e === "string") return e;
            const loc = Array.isArray(e.loc) ? e.loc.filter((p) => p !== "body").join(".") : "";
            const msg = e.msg || JSON.stringify(e);
            return loc ? `${loc}: ${msg}` : msg;
        });
        return parts.join("; ") || fallback;
    }
    return typeof detail === "object" ? JSON.stringify(detail) : String(detail);
}

async function apiRequest(path, options) {
    const res = await fetch(API_BASE + path, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok) {
        let message = res.statusText || `Request failed (${res.status})`;
        try {
            const body = await res.json();
            message = formatErrorDetail(body, message);
        } catch (_) { /* no json body */ }
        throw new Error(message);
    }
    if (res.status === 204) return null;
    return res.json();
}

export const api = {
    list: (type) => apiRequest(SCHEMA[type].endpoint, { method: "GET" }),
    get: (type, name) => apiRequest(`${SCHEMA[type].endpoint}/${encodeURIComponent(name)}`, {
        method: "GET",
    }),
    create: (type, payload) => apiRequest(SCHEMA[type].endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
    }),
    update: (type, name, payload) => apiRequest(`${SCHEMA[type].endpoint}/${encodeURIComponent(name)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    }),
    remove: (type, name) => apiRequest(`${SCHEMA[type].endpoint}/${encodeURIComponent(name)}`, {
        method: "DELETE",
    }),
    resolve: (type, name) => apiRequest(`${SCHEMA[type].endpoint}/${encodeURIComponent(name)}/resolve`, {
        method: "GET",
    }),
};
