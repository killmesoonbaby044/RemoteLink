// Entry point for the "Interface config" page
// (template/pages/network/interface.html).
//
// Three steps, each collapsing to a one-line summary once it's done so
// focus moves on to the next one:
//   1. device    - picked from the inventory tree (device-picker.js)
//   2. interface - picked from "show interfaces status" (ports.js)
//   3. configure - pre-filled form, only changed fields are sent
//      (form.js); Preview -> Run -> Save / Revert (results.js); one-click
//      port actions on access ports (actions.js).
//
// This file only handles step 1 and wires the modules together.

import * as api from "./api.js";
import * as dom from "./dom.js";
import * as render from "./render.js";
import {awaitingDecision, hooks, state} from "./state.js";
import {reveal} from "./ui.js";
import {createDevicePicker} from "./device-picker.js";
import {loadInterfaces, openPendingPort, portStep, wirePorts} from "./ports.js";
import {wireForm} from "./form.js";
import {setUnsaved, showResultMessage, wireResults} from "./results.js";
import {wireActions} from "./actions.js";
import {loadVlans, wireVlanPickers} from "./vlans.js";

const deviceStep = { summary: dom.deviceSummary, body: dom.deviceBody };

let picker = null;
let inventoryLoaded = Promise.resolve();

function selectHost(host) {
    state.host = host;
    state.port = null;
    state.interfaces = [];
    state.openOnLoad = false;
    state.portOnLoad = null;
    setUnsaved(false); // write memory is per switch

    dom.deviceValue.textContent = `${host.name} · ${host.address}`;
    render.setStepCollapsed(deviceStep, true);

    dom.configSection.hidden = true;
    render.setStepCollapsed(portStep, false);
    dom.portFilter.value = "";
    loadInterfaces({ focusFilter: true });
    loadVlans();
}

if (dom.tree) {
    picker = createDevicePicker({
        container: dom.tree,
        filterInput: dom.hostFilter,
        statusEl: dom.hostStatus,
        expandButton: dom.treeExpand,
        collapseButton: dom.treeCollapse,
        onPick: selectHost,
    });

    dom.deviceChange.addEventListener("click", () => {
        render.setStepCollapsed(deviceStep, false);
        reveal(dom.deviceBody, dom.hostFilter);
    });

    hooks.refreshInterfaces = () => loadInterfaces();

    wirePorts();
    wireForm();
    wireResults();
    wireActions();
    wireVlanPickers();

    // ?host=<inventory name>&port=<interface> (links from the MAC lookup
    // table) skip straight to that switch and port.
    const params = new URLSearchParams(window.location.search);
    const urlHost = params.get("host");
    const urlPort = params.get("port");

    inventoryLoaded = picker.load(api.fetchInventory).then(() => {
        if (urlHost && picker.pick(urlHost)) {
            if (urlPort) state.portOnLoad = urlPort;
            return;
        }
        picker.focus();
    });
}

export function reloadInventory() {
    inventoryLoaded = picker.load(api.fetchInventory);
    return inventoryLoaded;
}

// Goes to a switch (inventory name), and a port if given, for the popup on
// the inventory page. Staying on the current switch and port keeps everything
// on screen. Moving away is what could lose a change, so:
//  - a Run waiting for Save / Revert keeps the page where it is: leaving
//    would lose the snapshot Revert goes back to;
//  - unsaved changes on this switch ask first, since nothing shows them for
//    the next one.
export async function showInterface(hostName, port = null) {
    await inventoryLoaded;

    const sameHost = state.host?.name === hostName;
    const samePort = !port || state.port?.toLowerCase() === port.toLowerCase();
    if (sameHost && samePort) return;

    if (awaitingDecision()) {
        showResultMessage(`Save or Revert this change on ${state.port} before opening another interface.`, true);
        reveal(dom.result, dom.saveButton);
        return;
    }

    if (sameHost) {
        state.portOnLoad = port;
        if (state.interfaces.length) openPendingPort();
        return;
    }

    if (state.unsaved && !window.confirm(`${state.host.name} has changes not saved to startup-config. Open ${hostName} anyway?`)) {
        return;
    }
    if (picker.pick(hostName)) state.portOnLoad = port;
}
