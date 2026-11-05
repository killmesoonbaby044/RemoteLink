// Step 3, the configuration form: pre-filling it from the running
// config, marking lines for removal, extra lines, building the change
// payload (only fields that differ from the switch) and the dry-run
// preview.

import * as api from "./api.js";
import * as dom from "./dom.js";
import * as render from "./render.js";
import {awaitingDecision, state} from "./state.js";
import {requireCredentials, reveal, setBusy} from "./ui.js";
import {FORBIDDEN_TEXT_RE, PORT_SECURITY_MAX, VLAN_LIST_RE, VLAN_MAX} from "./config.js";

// Form fields that mirror a running-config value: how to read the
// switch's current value (as the string the input shows) and what to
// send. `trunk: true` fields are also editable on trunk ports.
const FIELDS = {
    description: {
        input: dom.description,
        current: (c) => c.description,
        trunk: true,
    },
    access_vlan: {
        input: dom.accessVlan,
        current: (c) => c.access_vlan,
    },
    voice_vlan: {
        input: dom.voiceVlan,
        current: (c) => c.voice_vlan,
    },
    port_security: {
        input: dom.portSecurity,
        current: (c) => c.port_security,
    },
    port_security_max: {
        input: dom.portSecurityMax,
        current: (c) => c.port_security_max,
    },
};

// ---------- showing the config ----------

export function resetChangeUi() {
    state.removed = new Set();
    state.pendingChange = null;
    state.pendingAction = null;
    dom.confirmBox.hidden = true;
    dom.formError.hidden = true;
    dom.preview.hidden = true;
    dom.result.hidden = true;
    dom.form.hidden = false;
}

export function fillForm() {
    for (const field of Object.values(FIELDS)) {
        field.input.value = field.current(state.config);
    }
    dom.trunkAdd.value = "";
    dom.trunkRemove.value = "";
    dom.extraLines.innerHTML = "";
    markChangedFields();
}

function markChangedFields() {
    for (const wrapper of dom.trackedFields) {
        const field = FIELDS[wrapper.dataset.field];
        const changed = state.config && field.input.value.trim() !== field.current(state.config);
        wrapper.classList.toggle("is-changed", Boolean(changed));
    }
}

export function renderConfig() {
    const config = state.config;
    const trunk = config.is_trunk;
    const locked = awaitingDecision();

    // A trunk without "switchport mode trunk" is negotiated (DTP) or
    // its mode couldn't be read - say so, it explains the locked form.
    const configured = config.lines.includes("switchport mode trunk");
    dom.modeBadge.textContent = !trunk ? "Access"
        : configured ? "Trunk"
        : config.operational_mode ? `Trunk (${config.operational_mode}, not configured)`
        : "Trunk? (mode unknown - locked)";
    dom.modeBadge.classList.toggle("is-trunk", trunk);
    dom.shutdownBadge.hidden = !config.shutdown;

    if (trunk) {
        dom.linesHint.textContent = "Trunk port: lines can't be removed here - only the description and allowed VLANs can change.";
    } else if (locked) {
        dom.linesHint.textContent = "Save or revert the change below before making another one.";
    } else {
        dom.linesHint.textContent = "Click a line to remove it (sends \"no …\"). Click again to keep it.";
    }

    render.renderLines(dom.lines, config.lines, {
        removable: !trunk && !locked,
        removed: state.removed,
        onToggle: toggleLine,
    });

    for (const field of dom.modeFields) {
        field.hidden = field.dataset.mode !== (trunk ? "trunk" : "access");
    }

    // Port actions: access ports only, and only the ones that make sense now.
    dom.actionsPanel.hidden = trunk;
    for (const button of dom.actionButtons) {
        const action = button.dataset.action;
        button.disabled = locked
            || (action === "enable" && !config.shutdown)
            || (action === "disable" && config.shutdown)
            || (action === "clear-sticky" && config.port_security !== "sticky");
    }
}

// The switch now holds `config`: show it everywhere and start the next
// change from it.
export function adoptConfig(config) {
    state.config = config;
    state.removed = new Set();
    fillForm();
    renderConfig();
}

function toggleLine(line) {
    if (state.removed.has(line)) state.removed.delete(line);
    else state.removed.add(line);
    invalidatePreview();
    renderConfig();
}

function addExtraLine() {
    const input = render.addExtraLineRow(dom.extraLines, { onRemove: invalidatePreview });
    input.focus();
}

// ---------- building the change ----------

function checkNumber(value, max, label) {
    if (value && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max)) {
        throw new Error(`${label} must be a number from 1 to ${max}.`);
    }
    return value;
}

function checkVlanList(input, label) {
    const raw = input.value.replace(/\s+/g, "");
    if (!raw) return null;
    if (!VLAN_LIST_RE.test(raw) || raw.split(/[,-]/).some((v) => Number(v) < 1 || Number(v) > VLAN_MAX)) {
        throw new Error(`${label}: use VLAN ids 1-${VLAN_MAX}, like 30 or 30,40-45.`);
    }
    return raw;
}

function checkText(value, label) {
    if (FORBIDDEN_TEXT_RE.test(value)) throw new Error(`${label} can't contain '?' or control characters.`);
    return value;
}

// Only fields that differ from the running config go into the payload.
function collectChange() {
    const config = state.config;
    const change = { host: state.host.name, interface: state.port };

    for (const [name, field] of Object.entries(FIELDS)) {
        if (config.is_trunk && !field.trunk) continue;
        const value = field.input.value.trim();
        if (value === field.current(config)) continue;
        change[name] = field.toPayload ? field.toPayload(value) : value;
    }

    if ("description" in change) checkText(change.description, "Description");
    if ("access_vlan" in change) checkNumber(change.access_vlan, VLAN_MAX, "Access VLAN");
    if ("voice_vlan" in change) checkNumber(change.voice_vlan, VLAN_MAX, "Voice VLAN");
    if ("port_security_max" in change) checkNumber(change.port_security_max, PORT_SECURITY_MAX, "Port-security maximum");

    if (config.is_trunk) {
        change.trunk_add_vlans = checkVlanList(dom.trunkAdd, "Add allowed VLANs");
        change.trunk_remove_vlans = checkVlanList(dom.trunkRemove, "Remove allowed VLANs");
    } else {
        change.remove_lines = Array.from(state.removed);
        change.extra_lines = Array.from(dom.extraLines.querySelectorAll("input"))
            .map((input) => checkText(input.value.trim(), "Extra lines"))
            .filter(Boolean);
    }
    return change;
}

export function invalidatePreview() {
    state.pendingChange = null;
    dom.preview.hidden = true;
    dom.formError.hidden = true;
    markChangedFields();
}

export function showFormError(message) {
    dom.formError.textContent = message;
    dom.formError.hidden = !message;
}

async function onPreview(event) {
    event.preventDefault();
    if (!requireCredentials()) return;

    let change;
    try {
        change = collectChange();
    } catch (err) {
        showFormError(err.message);
        return;
    }
    showFormError("");

    setBusy(dom.previewButton, true, "Checking…");
    try {
        const data = await api.previewChange(change);
        state.pendingChange = change;
        render.renderCommands(dom.previewCommands, data.commands);
        dom.preview.hidden = false;
        dom.result.hidden = true;
        reveal(dom.preview, dom.runButton);
    } catch (err) {
        showFormError(err.message);
    } finally {
        setBusy(dom.previewButton, false);
    }
}

export function wireForm() {
    dom.addLine.addEventListener("click", addExtraLine);
    dom.form.addEventListener("submit", onPreview);
    dom.form.addEventListener("input", invalidatePreview);
    dom.form.addEventListener("change", invalidatePreview);
    dom.editButton.addEventListener("click", () => {
        invalidatePreview();
        dom.description.focus();
    });
}
