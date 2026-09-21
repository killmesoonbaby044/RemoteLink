// Reads which mode this page load is in from the URL - see terminal.html.
// folder/script/args means a domain script run; host means an SSH
// connection.

export function getTerminalParams() {
    const params = new URLSearchParams(window.location.search);

    return {
        folder: params.get("folder"),
        script: params.get("script"),
        args: params.get("args"),
        host: params.get("host"),
    };
}
