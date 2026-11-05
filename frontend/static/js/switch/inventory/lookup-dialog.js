/**
 * The lookup popup on the inventory page. The form is the normal lookup
 * page's (partials/lookup_form.html + lookup/lookup.js).
 */

import {focusLookup, reloadTargets, setLookupTarget} from "../lookup/lookup.js";
import {openInterface} from "./interface-dialog.js";
import {createTaskDialog} from "./task-dialog.js";

const dialog = createTaskDialog("lookup-modal", "lookup-modal-close", reloadTargets);

export const markInventoryChanged = () => dialog.markInventoryChanged();

/** `target` is the {kind, name} of a row; leave it out to pick in the form. */
export function openLookup(target = null) {
    setLookupTarget(target);
    dialog.open();
    focusLookup();
}

export function setupLookupDialog() {
    document.getElementById("tree-lookup").addEventListener("click", () => openLookup());

    // An interface in the results opens on top of them. Ctrl/cmd-click still
    // gets the link's normal new tab.
    document.getElementById("lookup-results").addEventListener("click", (e) => {
        const link = e.target.closest("a[data-port]");
        if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        openInterface(link.dataset.host, link.dataset.port);
    });
}
