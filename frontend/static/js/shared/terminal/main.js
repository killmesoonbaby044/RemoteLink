// Entry point for the terminal page (templates/pages/terminal.html).
// Was terminal.js as one file - split the same way as the other
// features: dom/params/socket here, connect-ssh.js and run-script.js
// for the two modes, this file just dispatches between them.

import { getTerminalDom } from "./dom.js";
import { getTerminalParams } from "./params.js";
import { connectSSH } from "./connect-ssh.js";
import { runScript } from "./run-script.js";

const dom = getTerminalDom();

if (dom) {
    const terminal = new Terminal({
        cursorBlink: true,
        convertEol: true,
        fontSize: 16,
        rows: 30,
        cols: 120,
    });

    terminal.open(dom.container);
    terminal.focus();

    function setStatus(text) {
        dom.status.textContent = text;
    }

    const { folder, script, args, host } = getTerminalParams();

    // The server already renders a host/script-aware <title> (see
    // terminal.html); this just refines it client-side, preferring the
    // target PC name (args) over the raw script name when one was passed.
    if (script) {
        document.title = args || script;
    } else if (host) {
        document.title = host;
    }

    if (folder) {
        runScript(terminal, setStatus, folder, script, args);
    } else if (!host) {
        setStatus("Host is not specified");
        terminal.write("\r\nERROR: Host is not specified\r\n");
    } else {
        connectSSH(terminal, setStatus, host);
    }
}
