// Single place that reaches into the terminal page for its elements.
// Returns null if they're not on this page, so main.js can bail instead
// of throwing.

export function getTerminalDom() {
    const container = document.getElementById("terminal");
    const status = document.getElementById("status");

    if (!container || !status) {
        return null;
    }

    return { container, status };
}
