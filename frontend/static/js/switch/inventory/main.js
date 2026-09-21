/**
 * Entry point for the switch inventory page. Loaded from switch_inventory.html
 * as a module: <script type="module" src="/static/js/switch/inventory/main.js">
 *
 * Wires the two feature modules into core's render pipeline and sets up
 * the tab/modal chrome that isn't specific to either one.
 */

import { refresh, onRender } from "./core.js";
import { renderRecords, setupModalChrome } from "./records.js";
import { renderTree } from "./hierarchy.js";

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
    setupTabs();
    setupModalChrome();
    refresh();
});
