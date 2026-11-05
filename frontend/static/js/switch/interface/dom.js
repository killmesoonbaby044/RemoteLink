// Single place that reaches into the page for the interface-config
// elements. Everything is null when the page isn't loaded, so main.js
// can bail out with one check.

const $ = (id) => document.getElementById(id);

// step 1 - device
export const deviceSummary = $("iface-device-summary");
export const deviceValue = $("iface-device-value");
export const deviceChange = $("iface-device-change");
export const deviceBody = $("iface-device-body");
export const hostFilter = $("iface-host-filter");
export const treeExpand = $("iface-tree-expand");
export const treeCollapse = $("iface-tree-collapse");
export const hostStatus = $("iface-host-status");
export const tree = $("iface-tree");

// step 2 - interface
export const portsSection = $("iface-ports-section");
export const portsHost = $("iface-ports-host");
export const portsRefresh = $("iface-ports-refresh");
export const portSummary = $("iface-port-summary");
export const portValue = $("iface-port-value");
export const portChange = $("iface-port-change");
export const portsBody = $("iface-ports-body");
export const portFilter = $("iface-port-filter");
export const portsStatus = $("iface-ports-status");
export const portsWrap = $("iface-ports-wrap");
export const portsTable = $("iface-ports");

// step 3 - configure
export const configSection = $("iface-config-section");
export const configPort = $("iface-config-port");
export const shutdownBadge = $("iface-shutdown-badge");
export const modeBadge = $("iface-mode-badge");
export const headSave = $("iface-head-save");
export const saveStatus = $("iface-save-status");
export const configStatus = $("iface-config-status");
export const configBody = $("iface-config-body");

export const actionsPanel = $("iface-actions-panel");
export const actionButtons = actionsPanel ? Array.from(actionsPanel.querySelectorAll("[data-action]")) : [];
export const confirmBox = $("iface-confirm");
export const confirmText = $("iface-confirm-text");
export const confirmCommands = $("iface-confirm-commands");
export const confirmYes = $("iface-confirm-yes");
export const confirmNo = $("iface-confirm-no");

export const linesHint = $("iface-lines-hint");
export const lines = $("iface-lines");

export const form = $("iface-form");
export const description = $("iface-description");
export const accessVlan = $("iface-access-vlan");
export const voiceVlan = $("iface-voice-vlan");
export const portSecurity = $("iface-port-security");
export const portSecurityMax = $("iface-port-security-max");
export const trunkAdd = $("iface-trunk-add");
export const trunkRemove = $("iface-trunk-remove");
export const extraLines = $("iface-extra-lines");
export const addLine = $("iface-add-line");
export const formError = $("iface-form-error");
export const previewButton = $("iface-preview-btn");
export const modeFields = form ? Array.from(form.querySelectorAll("[data-mode]")) : [];
export const trackedFields = form ? Array.from(form.querySelectorAll("[data-field]")) : [];

export const preview = $("iface-preview");
export const previewCommands = $("iface-preview-commands");
export const runButton = $("iface-run-btn");
export const editButton = $("iface-edit-btn");

export const result = $("iface-result");
export const resultTitle = $("iface-result-title");
export const resultErrors = $("iface-result-errors");
export const resultConfig = $("iface-result-config");
export const resultMessage = $("iface-result-message");
export const resultActions = $("iface-result-actions");
export const saveButton = $("iface-save-btn");
export const revertButton = $("iface-revert-btn");
export const resultRaw = $("iface-result-raw");
