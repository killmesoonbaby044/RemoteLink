/**
 * Entry point for the switch inventory page. Loaded from pages/network/network.html
 * as a module: <script type="module" src="/static/js/network/inventory/main.js">
 *
 * Wires the two feature modules into core's render pipeline and sets up
 * the tab/modal chrome that isn't specific to either one.
 */

import {onRender, refresh} from "./core.js";
import {renderRecords, setupModalChrome, setupSearchInputs} from "./records.js";
import {renderTree, setupTreeControls} from "./hierarchy.js";
import {markInventoryChanged as markInterfaceStale} from "./interface-dialog.js";
import {markInventoryChanged as markLookupStale, setupLookupDialog} from "./lookup-dialog.js";

function setupTabs() {
    const tabs = document.querySelectorAll(".inv-tab");
    const panels = document.querySelectorAll(".inv-panel");
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            tabs.forEach((t) => {
                t.classList.remove("is-active");
                t.setAttribute("aria-selected", "false");
            });
            tab.classList.add("is-active");
            tab.setAttribute("aria-selected", "true");
            panels.forEach((p) => p.classList.remove("is-active"));
            document.querySelector(`.inv-panel[data-panel="${tab.dataset.tab}"]`).classList.add("is-active");
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    onRender(renderRecords);
    onRender(renderTree);
    onRender(markLookupStale);
    onRender(markInterfaceStale);
    setupTabs();
    setupModalChrome();
    setupSearchInputs();
    setupTreeControls();
    setupLookupDialog();
    refresh();
});
