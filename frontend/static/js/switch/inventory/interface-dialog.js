/**
 * The interface-config popup on the inventory page. The form is the normal
 * interface page's (partials/interface_form.html + interface/main.js).
 */

import {reloadInventory, showInterface} from "../interface/main.js";
import {createTaskDialog} from "./task-dialog.js";

const dialog = createTaskDialog("interface-modal", "interface-modal-close", reloadInventory);

export const markInventoryChanged = () => dialog.markInventoryChanged();

export async function openInterface(host, port = null) {
    await dialog.open();
    await showInterface(host, port);
}
