// Config for the "Interface config" page (template/pages/switch/switch_interface.html).

export const API_BASE = "/switch/tasks";

export const ENDPOINTS = {
    interfaces: `${API_BASE}/interfaces`,
    vlans: `${API_BASE}/vlans`,
    config: `${API_BASE}/interface-config`,
    apply: `${API_BASE}/interface-apply`,
    revert: `${API_BASE}/interface-revert`,
    action: `${API_BASE}/interface-action`,
    writeMemory: `${API_BASE}/write-memory`,
};

// Same limits the backend enforces (schemas.py) - checked here first so
// a typo gets a message next to the form instead of a 422. Standard IOS
// stops at VLAN 4094; higher ids are let through and the switch's own
// error is shown.
export const VLAN_MAX = 9999;
export const PORT_SECURITY_MAX = 4096;
export const VLAN_LIST_RE = /^\d{1,4}(?:-\d{1,4})?(?:,\d{1,4}(?:-\d{1,4})?)*$/;
export const FORBIDDEN_TEXT_RE = /[?\r\n\x00-\x1f]/;

// One-click port actions (access ports only). `commands` is only for
// the confirmation box - the backend builds what's actually sent.
export const ACTIONS = {
    "enable": {
        label: "Enable",
        confirm: (port) => `Enable ${port}?`,
        commands: (port) => [`interface ${port}`, " no shutdown"],
    },
    "disable": {
        label: "Disable",
        confirm: (port) => `Disable ${port}? The device on it loses its link.`,
        commands: (port) => [`interface ${port}`, " shutdown"],
    },
    "restart": {
        label: "Restart",
        confirm: (port) => `Restart ${port}? The link goes down and comes back up.`,
        commands: (port) => [`interface ${port}`, " shutdown", " no shutdown"],
    },
    "clear-sticky": {
        label: "Clear sticky MACs",
        confirm: (port) => `Clear sticky MAC addresses on ${port}? They are also removed from the running config; the port learns new ones.`,
        commands: (port) => [`clear port-security sticky interface ${port}`],
    },
    "reset-port-security": {
        label: "Reset port-security",
        confirm: (port) => `Reset port-security on ${port}? All secure MACs are cleared and the port is restarted (recovers from err-disabled).`,
        commands: (port) => [`clear port-security all interface ${port}`, `interface ${port}`, " shutdown", " no shutdown"],
    },
};
