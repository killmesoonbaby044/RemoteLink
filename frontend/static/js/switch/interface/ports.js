// Step 2: the switch's interfaces ("show interfaces status"), filtering
// them, and opening one - which loads its running config into step 3.

import * as api from "./api.js";
import * as dom from "./dom.js";
import * as render from "./render.js";
import {state} from "./state.js";
import {requireCredentials, reveal} from "./ui.js";
import {fillForm, renderConfig, resetChangeUi} from "./form.js";

export const portStep = { summary: dom.portSummary, body: dom.portsBody };

export async function loadInterfaces({ focusFilter = false } = {}) {
    if (!requireCredentials()) return;
    const host = state.host.name;

    dom.portsSection.hidden = false;
    dom.portsHost.textContent = host;
    dom.portsRefresh.disabled = true;
    if (!state.interfaces.length) dom.portsWrap.hidden = true;
    render.setStatus(dom.portsStatus, "Connecting to switch…");
    // Focus right away so typing ahead isn't lost; the rows are filtered
    // by whatever is in the box once they arrive.
    if (focusFilter) reveal(dom.portsSection, dom.portFilter);

    try {
        const data = await api.fetchInterfaces(host);
        if (state.host?.name !== host) return; // another switch was picked meanwhile
        state.interfaces = data.interfaces;
        if (!state.interfaces.length) {
            render.setStatus(dom.portsStatus, "No interfaces found in 'show interfaces status'.");
            return;
        }
        render.renderPorts(dom.portsTable, state.interfaces, { selectedPort: state.port, onSelect: selectPort });
        render.filterRows(dom.portsTable.querySelectorAll("tr"), dom.portFilter.value);
        dom.portsWrap.hidden = false;
        render.setStatus(dom.portsStatus, "");
        updatePortSummary();
        if (state.portOnLoad) {
            openPortFromUrl();
        } else if (state.openOnLoad) {
            state.openOnLoad = false;
            openSingleVisiblePort();
        }
    } catch (err) {
        if (state.host?.name === host) render.setStatus(dom.portsStatus, err.message, true);
    } finally {
        dom.portsRefresh.disabled = false;
    }
}

function openSingleVisiblePort() {
    const visible = Array.from(dom.portsTable.querySelectorAll("tr")).filter((tr) => !tr.hidden);
    if (visible.length === 1) selectPort(visible[0].dataset.port);
    else visible[0]?.focus();
}

// ?port= comes from the MAC lookup table; match it case-insensitively
// against "show interfaces status". If it isn't there, leave it in the
// filter so the closest rows are what's shown.
function openPortFromUrl() {
    const wanted = state.portOnLoad.toLowerCase();
    state.portOnLoad = null;
    const iface = state.interfaces.find((i) => i.port.toLowerCase() === wanted);
    if (iface) {
        selectPort(iface.port);
    } else {
        dom.portFilter.value = wanted;
        render.filterRows(dom.portsTable.querySelectorAll("tr"), wanted);
    }
}

function updatePortSummary() {
    const iface = state.interfaces.find((i) => i.port === state.port);
    if (iface) dom.portValue.textContent = render.portSummaryText(iface);
}

async function selectPort(port) {
    if (!requireCredentials()) return;

    state.port = port;
    state.config = null;
    state.snapshot = null;
    render.markSelectedPort(dom.portsTable, port);
    updatePortSummary();
    render.setStepCollapsed(portStep, true);

    dom.configSection.hidden = false;
    dom.configPort.textContent = port;
    dom.modeBadge.textContent = "";
    dom.shutdownBadge.hidden = true;
    dom.saveStatus.hidden = true;
    dom.configBody.hidden = true;
    resetChangeUi();
    render.setStatus(dom.configStatus, `Reading running config of ${port}…`);
    reveal(dom.configSection);

    try {
        const config = await api.fetchConfig(state.host.name, port);
        if (state.port !== port) return; // another row was clicked meanwhile
        state.config = config;
        fillForm();
        renderConfig();
        dom.configBody.hidden = false;
        render.setStatus(dom.configStatus, "");
        reveal(dom.configSection, dom.description);
    } catch (err) {
        if (state.port === port) render.setStatus(dom.configStatus, err.message, true);
    }
}

export function wirePorts() {
    dom.portFilter.addEventListener("input", () => {
        render.filterRows(dom.portsTable.querySelectorAll("tr"), dom.portFilter.value);
    });
    // Enter in the filter opens the port when exactly one row is left
    // (or as soon as the list arrives, if it's still loading).
    dom.portFilter.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (!state.interfaces.length) state.openOnLoad = true;
        else openSingleVisiblePort();
    });
    dom.portsRefresh.addEventListener("click", () => loadInterfaces());
    dom.portChange.addEventListener("click", () => {
        render.setStepCollapsed(portStep, false);
        reveal(dom.portsSection, dom.portFilter);
    });
}
