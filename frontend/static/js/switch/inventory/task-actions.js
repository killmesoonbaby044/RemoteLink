/**
 * The task actions a row offers (SSH, interface config, lookup). One place
 * so the hierarchy and the Root points / Groups / Hosts tables stay the same.
 */

import {el} from "./core.js";
import {openInterface} from "./interface-dialog.js";
import {openLookup} from "./lookup-dialog.js";

function actionButton(label, title, size, onclick) {
    return el("button", { class: `btn ${size} tree-action`, type: "button", title, text: label, onclick });
}

export function lookupAction(kind, name, size = "btn-small") {
    return actionButton("Lookup", `MAC lookup (${name})`, size, () => openLookup({ kind, name }));
}

export function hostActions(host, size = "btn-small") {
    return [
        el("a", {
            class: `btn ${size} tree-action`,
            href: `/ssh_terminal?host=${encodeURIComponent(host.address)}`,
            title: `SSH to ${host.address}`,
            target: "_blank",
            rel: "noopener",
            text: "SSH",
        }),
        actionButton("Interface", `Configure an interface on ${host.name}`, size, () => openInterface(host.name)),
        lookupAction("host", host.name, size),
    ];
}
