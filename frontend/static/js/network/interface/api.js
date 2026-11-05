// Every request the interface-config page makes. All of them are POSTs
// to /switch/tasks/* carrying the SSH credentials from the credentials
// page, same as the MAC lookup.

import {getCredentials} from "../../shared/credentials/store.js";
import {api as inventoryApi} from "../inventory/api.js";
import {ENDPOINTS} from "./config.js";

// FastAPI errors come back as {"detail": "..."} (our 409/502s) or, for
// a 422, as the HTML alert() page from validation_exception_handler -
// pull the message out of either.
async function readError(response) {
    const text = await response.text();
    try {
        const detail = JSON.parse(text).detail;
        if (typeof detail === "string") return detail;
        if (detail) return JSON.stringify(detail);
    } catch (_) {
        const alert = text.match(/alert\((['"])([\s\S]*?)\1\)/);
        if (alert) return alert[2].replace(/\\n/g, "; ");
    }
    return `Request failed (${response.status}).`;
}

async function post(endpoint, payload) {
    const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...getCredentials() }),
    });
    if (!response.ok) throw new Error(await readError(response));
    return response.json();
}

// Everything the device tree needs, in one go.
export async function fetchInventory() {
    const [roots, groups, hosts] = await Promise.all([
        inventoryApi.list("root"),
        inventoryApi.list("group"),
        inventoryApi.list("host"),
    ]);
    return { roots, groups, hosts };
}

export const fetchInterfaces = (host) => post(ENDPOINTS.interfaces, { host });

export const fetchVlans = (host) => post(ENDPOINTS.vlans, { host });

export const fetchConfig = (host, iface) => post(ENDPOINTS.config, { host, interface: iface });

export const previewChange = (change) => post(ENDPOINTS.apply, { ...change, dry_run: true });

export const applyChange = (change) => post(ENDPOINTS.apply, { ...change, dry_run: false });

export const revertChange = (host, iface, beforeLines) =>
    post(ENDPOINTS.revert, { host, interface: iface, before_lines: beforeLines });

export const runAction = (host, iface, action) =>
    post(ENDPOINTS.action, { host, interface: iface, action });

export const writeMemory = (host) => post(ENDPOINTS.writeMemory, { host });
