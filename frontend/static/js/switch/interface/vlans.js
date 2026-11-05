// VLAN pickers: the Access / Voice VLAN fields and the trunk "allowed
// VLANs" fields get a dropdown of the switch's own VLANs ("show vlan
// brief") - "374 (USERS)". Picking one fills in just the number; typing
// a number by hand still works, VLAN on the switch or not.
//
// Single-value fields replace their content with the picked id. List
// fields (trunk add/remove, "30,40-45") filter by and replace only the
// part after the last comma, so ids can be picked one after another.

import * as api from "./api.js";
import * as dom from "./dom.js";
import {state} from "./state.js";
import {createAutosuggest} from "../../common/autosuggest.js";

function label(vlan) {
    return vlan.name ? `${vlan.id} (${vlan.name})` : vlan.id;
}

function idOf(item) {
    return item.split(" ")[0];
}

// A row matches when its id starts with what's typed, or its name
// contains it - "us" finds "374 (USERS)".
function matches(item, query) {
    const vlan = state.vlans.find((v) => v.id === idOf(item));
    return item.startsWith(query) || Boolean(vlan?.name.toLowerCase().includes(query));
}

function lastToken(value) {
    return value.slice(value.lastIndexOf(",") + 1);
}

function wirePicker(input, { list = false } = {}) {
    if (!input) return;
    createAutosuggest({
        wrapper: document.getElementById(`${input.id}-wrapper`),
        input,
        menu: document.getElementById(`${input.id}-menu`),
        getItems: () => state.vlans.map(label),
        matches,
        getQuery: list ? () => lastToken(input.value) : undefined,
        applyItem: list
            ? (item) => {
                const head = input.value.slice(0, input.value.lastIndexOf(",") + 1);
                input.value = head + idOf(item);
            }
            : (item) => { input.value = idOf(item); },
    });
}

export function wireVlanPickers() {
    wirePicker(dom.accessVlan);
    wirePicker(dom.voiceVlan);
    wirePicker(dom.trunkAdd, { list: true });
    wirePicker(dom.trunkRemove, { list: true });
}

// Loaded once per picked switch, in the background: until it arrives
// (or if it fails) the fields are plain inputs - typing a number works
// either way, so a failure isn't shown.
export async function loadVlans() {
    const host = state.host.name;
    state.vlans = [];
    try {
        const data = await api.fetchVlans(host);
        if (state.host?.name === host) state.vlans = data.vlans;
    } catch (err) {
        console.warn(`Could not load VLANs of ${host}:`, err);
    }
}
