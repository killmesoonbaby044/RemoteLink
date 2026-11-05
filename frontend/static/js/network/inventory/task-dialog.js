/**
 * Show/hide for the task popups on the inventory page (lookup, interface
 * config). Their forms are loaded once with the page, so closing one keeps
 * whatever is in it. They can stack: Escape closes the one on top.
 */

const stack = [];

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") stack.at(-1)?.close();
});

/** `reload` refreshes the popup's own copy of the inventory; it runs on the
 *  next open after the inventory changed. */
export function createTaskDialog(backdropId, closeId, reload) {
    const backdrop = document.getElementById(backdropId);
    let rendered = false;
    let stale = false;
    let opener = null;

    const dialog = {
        /** Resolves once the popup's inventory is current. */
        open() {
            if (!backdrop.classList.contains("is-hidden")) return Promise.resolve();
            opener = document.activeElement;
            backdrop.classList.remove("is-hidden");
            stack.push(dialog);
            if (!stale) return Promise.resolve();
            stale = false;
            return reload();
        },
        close() {
            backdrop.classList.add("is-hidden");
            stack.splice(stack.indexOf(dialog), 1);
            opener?.focus({ preventScroll: true });
            opener = null;
        },
        /** Registered with core's onRender(): after the first load, a render
         *  means the inventory changed. */
        markInventoryChanged() {
            stale = rendered;
            rendered = true;
        },
    };

    document.getElementById(closeId).addEventListener("click", () => dialog.close());
    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) dialog.close();
    });
    return dialog;
}
