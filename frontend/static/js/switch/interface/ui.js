// Small stateless helpers shared by the interface-config modules.

import {hasCredentials} from "../../shared/credentials/store.js";

export function requireCredentials() {
    if (hasCredentials()) return true;
    window.location.href = "/credentials";
    return false;
}

// Disables `button` and swaps its text while a request runs; the
// original label is remembered on the button itself.
export function setBusy(button, busy, busyText) {
    if (!button.dataset.label) button.dataset.label = button.textContent.trim();
    button.disabled = busy;
    button.textContent = busy ? busyText : button.dataset.label;
}

// Sets --header-height on <html> to the sticky site header's current
// height. interface.css uses it in scroll-margin-top, so a scrolled-to
// block clears the header whatever its size (it grows when the window is
// narrow, the font is larger, or the header content wraps) - nothing
// assumes a fixed pixel height.
function syncHeaderHeight() {
    const header = document.querySelector(".header");
    if (header) document.documentElement.style.setProperty("--header-height", `${header.offsetHeight}px`);
}

// Focuses `focusTarget` right away (so nothing typed next is lost) and
// scrolls `node` to just below the sticky header on the next frame - a
// smooth scroll started before the layout of whatever was just
// shown/hidden settles stops short. The header is measured at that
// moment, so its height is always current.
export function reveal(node, focusTarget) {
    focusTarget?.focus({ preventScroll: true });
    requestAnimationFrame(() => {
        syncHeaderHeight();
        node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
}
