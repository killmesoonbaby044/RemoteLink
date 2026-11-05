// Shared, mutable state of the interface-config page. Every module reads
// and writes this one object; nothing else holds page state.

export const state = {
    host: null,            // Host from the inventory
    interfaces: [],        // "show interfaces status" rows for that host
    vlans: [],             // "show vlan brief" rows for that host, for the VLAN pickers
    port: null,
    config: null,          // InterfaceConfig currently on the switch
    removed: new Set(),    // running-config lines marked for "no ..."
    pendingChange: null,   // the payload that was previewed, sent as-is by Run
    snapshot: null,        // config.lines right before the last Run, for Revert
    pendingAction: null,   // port action waiting for its confirmation
    openOnLoad: false,     // Enter was pressed in the port filter before the list arrived
    portOnLoad: null,      // port asked for from outside (URL or popup), opened once the list arrives
    unsaved: false,        // running-config changed since the last write memory
    unsavedBeforeRun: false,
};

// Set by main.js. A hook rather than an import so results.js and
// actions.js can refresh the interface list without importing ports.js,
// which imports form.js -> keeps the module graph one-directional.
export const hooks = {
    refreshInterfaces: () => {},
};

// A Run is waiting for Save or Revert: lines, form and actions are locked
// so the snapshot Revert goes back to stays valid.
export function awaitingDecision() {
    return Boolean(state.snapshot);
}
