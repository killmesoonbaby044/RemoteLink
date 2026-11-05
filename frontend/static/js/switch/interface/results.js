// What happens after a change reaches the switch: Run, the result panel,
// Save (write memory - from the result panel or the Configure header)
// and Revert. Also tracks whether the running-config has unsaved
// changes, which the header Save button shows.

import * as api from "./api.js";
import * as dom from "./dom.js";
import * as render from "./render.js";
import {awaitingDecision, hooks, state} from "./state.js";
import {requireCredentials, reveal, setBusy} from "./ui.js";
import {adoptConfig, fillForm, renderConfig, showFormError} from "./form.js";

// ---------- unsaved indicator ----------

export function setUnsaved(unsaved) {
    state.unsaved = unsaved;
    dom.headSave.classList.toggle("iface-btn-primary", unsaved);
    dom.headSave.classList.toggle("iface-btn-secondary", !unsaved);
    dom.headSave.title = unsaved
        ? "The running-config has changes that aren't saved to startup-config yet."
        : "Write the running-config to startup-config (write memory).";
}

function showSaveStatus(text, isError = false) {
    dom.saveStatus.textContent = text;
    dom.saveStatus.classList.toggle("lookup-error", isError);
    dom.saveStatus.hidden = !text;
}

// ---------- result panel ----------

export function showResult(title, data, { canRevert }) {
    dom.resultTitle.textContent = title;
    render.renderErrors(dom.resultErrors, data.errors || []);
    render.renderConfigBlock(dom.resultConfig, data.after);
    dom.resultRaw.textContent = data.output || "";
    dom.resultMessage.hidden = true;
    dom.resultActions.hidden = false;
    dom.saveButton.disabled = false;
    dom.revertButton.hidden = !canRevert;
    dom.revertButton.disabled = false;
    dom.result.hidden = false;
    showSaveStatus("");

    if (data.errors?.length) {
        showResultMessage("The switch rejected some commands - check the errors above.", true);
    }
    reveal(dom.result, dom.saveButton);
}

function showResultMessage(text, isError = false) {
    dom.resultMessage.textContent = text;
    dom.resultMessage.classList.toggle("lookup-error", isError);
    dom.resultMessage.hidden = false;
}

// Closes a result that's waiting for a decision (Save / Revert) and
// unlocks the form for the next change.
function finishChange(message, isError = false) {
    dom.resultActions.hidden = true;
    showResultMessage(message, isError);
    state.snapshot = null;
    fillForm();
    renderConfig();
    dom.form.hidden = false;
}

// ---------- run ----------

async function onRun() {
    if (!state.pendingChange || !requireCredentials()) return;

    setBusy(dom.runButton, true, "Running…");
    dom.editButton.disabled = true;
    try {
        const data = await api.applyChange(state.pendingChange);
        state.snapshot = data.before.lines;
        state.unsavedBeforeRun = state.unsaved;
        state.pendingChange = null;
        setUnsaved(true);
        dom.preview.hidden = true;
        dom.form.hidden = true;
        adoptConfig(data.after);
        showResult(`Running config of ${data.after.interface}`, data, { canRevert: true });
    } catch (err) {
        showFormError(err.message);
    } finally {
        setBusy(dom.runButton, false);
        dom.editButton.disabled = false;
    }
}

// ---------- save ----------

// Shared by the result panel's Save and the header's "Save switch
// config". write memory saves the whole switch, so either button also
// settles a result that's waiting for Save / Revert.
async function saveConfig(button) {
    if (!requireCredentials()) return;

    const resultOpen = !dom.result.hidden && !dom.resultActions.hidden;
    setBusy(button, true, "Saving…");
    dom.headSave.disabled = dom.saveButton.disabled = dom.revertButton.disabled = true;
    try {
        const data = await api.writeMemory(state.host.name);
        if (resultOpen) dom.resultRaw.textContent += `\n\n${data.output}`;

        if (data.ok) {
            setUnsaved(false);
            showSaveStatus(`Saved ${state.host.name} to startup-config.`);
            if (resultOpen) finishChange("Saved to startup-config.");
            hooks.refreshInterfaces();
        } else {
            showSaveStatus("write memory didn't report [OK] - check the switch.", true);
            if (resultOpen) showResultMessage("write memory didn't report [OK] - check the session output.", true);
        }
    } catch (err) {
        showSaveStatus(err.message, true);
        if (resultOpen) showResultMessage(err.message, true);
    } finally {
        setBusy(button, false);
        dom.headSave.disabled = dom.saveButton.disabled = false;
        dom.revertButton.disabled = !awaitingDecision();
    }
}

// ---------- revert ----------

async function onRevert() {
    if (!state.snapshot || !requireCredentials()) return;

    setBusy(dom.revertButton, true, "Reverting…");
    dom.saveButton.disabled = dom.headSave.disabled = true;
    try {
        const data = await api.revertChange(state.host.name, state.port, state.snapshot);
        // Order-insensitive: the switch may list the restored lines in a different order.
        const sorted = (lines) => JSON.stringify([...lines].sort());
        const matches = sorted(data.after.lines) === sorted(state.snapshot);

        state.config = data.after;
        setUnsaved(state.unsavedBeforeRun);
        showResult(`Reverted ${data.after.interface}`, data, { canRevert: false });
        finishChange(
            matches
                ? "Reverted to the original config (running-config only, nothing saved)."
                : "Reverted, but the config doesn't exactly match the original - check it above.",
            !matches,
        );
        reveal(dom.result, dom.description);
    } catch (err) {
        showResultMessage(err.message, true);
        dom.saveButton.disabled = false;
    } finally {
        setBusy(dom.revertButton, false);
        dom.headSave.disabled = false;
    }
}

export function wireResults() {
    dom.runButton.addEventListener("click", onRun);
    dom.saveButton.addEventListener("click", () => saveConfig(dom.saveButton));
    dom.headSave.addEventListener("click", () => saveConfig(dom.headSave));
    dom.revertButton.addEventListener("click", onRevert);
}
