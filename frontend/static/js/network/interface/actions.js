// One-click port actions on access ports: enable / disable / restart,
// clear sticky MACs, reset port-security. Each asks for an in-page
// confirmation showing the commands, then runs immediately (no preview
// step) and shows the new config with Save.

import * as api from "./api.js";
import * as dom from "./dom.js";
import * as render from "./render.js";
import {hooks, state} from "./state.js";
import {requireCredentials, setBusy} from "./ui.js";
import {ACTIONS} from "./config.js";
import {adoptConfig, invalidatePreview} from "./form.js";
import {setUnsaved, showResult} from "./results.js";

function askAction(action) {
    state.pendingAction = action;
    const meta = ACTIONS[action];
    dom.confirmText.textContent = meta.confirm(state.port);
    dom.confirmText.classList.remove("lookup-error");
    render.renderCommands(dom.confirmCommands, meta.commands(state.port));
    dom.confirmYes.textContent = meta.label;
    dom.confirmYes.dataset.label = meta.label;
    dom.confirmBox.hidden = false;
    dom.confirmYes.focus();
}

function cancelAction() {
    state.pendingAction = null;
    dom.confirmBox.hidden = true;
}

async function onConfirmAction() {
    const action = state.pendingAction;
    if (!action || !requireCredentials()) return;

    setBusy(dom.confirmYes, true, "Running…");
    dom.confirmNo.disabled = true;
    try {
        const data = await api.runAction(state.host.name, state.port, action);
        cancelAction();
        invalidatePreview();
        setUnsaved(true);
        adoptConfig(data.after);
        showResult(`${ACTIONS[action].label}: ${data.after.interface}`, data, { canRevert: false });
        hooks.refreshInterfaces(); // status column / summary reflect the new state
    } catch (err) {
        dom.confirmText.textContent = err.message;
        dom.confirmText.classList.add("lookup-error");
    } finally {
        setBusy(dom.confirmYes, false);
        dom.confirmNo.disabled = false;
    }
}

export function wireActions() {
    for (const button of dom.actionButtons) {
        button.addEventListener("click", () => askAction(button.dataset.action));
    }
    dom.confirmYes.addEventListener("click", onConfirmAction);
    dom.confirmNo.addEventListener("click", cancelAction);
}
