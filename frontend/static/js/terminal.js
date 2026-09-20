import { openTypedSocket } from "./common/ws.js";
import { pushHistory } from "./common/history.js";
import { getCredentials } from "./common/credentials.js";
import { buildScriptSocketPath } from "./common/script-ref.js";

const terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,
    fontSize: 16,
    rows: 30,
    cols: 120,
});

terminal.open(document.getElementById("terminal"));
terminal.focus();

const statusEl = document.getElementById("status");

const params = new URLSearchParams(window.location.search);
// DOMAIN_SCRIPTS
const folder = params.get("folder");
const script = params.get("script");
const args = params.get("args");
//SSH SCRIPTS
const host = params.get("host");

function setStatus(text) {
    statusEl.textContent = text;
}

// The server already renders a host/script-aware <title> (see
// terminal.html); this just refines it client-side, preferring the
// target PC name (args) over the raw script name when one was passed.
if (script) {
    document.title = args || script;
} else if (host) {
    document.title = host;
}

// Shared by both SSH and script sessions: both are just a WebSocket that
// streams terminal bytes in and takes raw keystrokes back. This one
// function is the single place that "connect to ws" happens for the
// terminal page -- connectSSH/runScript only differ in the URL and what
// they do on open/extra message types.
function openTerminalSocket(path, { onOpen, extraTypes = {} } = {}) {
    const socket = openTypedSocket(path, {
        binaryType: "arraybuffer",
        onOpen,
        onError: () => {
            setStatus("WebSocket error");
            terminal.write("\r\nWebSocket error\r\n");
        },
        onClose: () => {
            setStatus("Disconnected");
            terminal.write("\r\nConnection closed\r\n");
        },
        onRaw: (text) => terminal.write(text),
        onBinary: (buffer) => terminal.write(new TextDecoder("utf-8").decode(buffer)),
        types: {
            status: (message) => setStatus(message.message),
            error: (message) => {
                terminal.write(`\r\nERROR: ${message.message}\r\n`);
                setStatus("Error");
            },
            ...extraTypes,
        },
    });

    terminal.onData((data) => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(data);
        }
    });

    return socket;
}

function connectSSH(targetHost) {
    const { username, password } = getCredentials();

    if (!username || !password) {
        setStatus("Credentials are not configured");
        terminal.write("\r\nERROR: SSH credentials are not configured.\r\n");
        return;
    }

    openTerminalSocket(`/ws/ssh?host=${encodeURIComponent(targetHost)}`, {
        onOpen: (socket) => {
            setStatus(`Authenticating to ${targetHost}...`);
            socket.send(JSON.stringify({ type: "auth", username, password }));
            pushHistory({ type: "ssh", host: targetHost });
        },
    });
}

function runScript(folder, script, args) {
    // Fully interactive: the server runs this script inside a PTY, so
    // prompts, typed input, and keystrokes flow both ways in real time,
    // same as an SSH session.
    openTerminalSocket(buildScriptSocketPath(folder, script, args), {
        onOpen: () => setStatus(`Starting ${script}...`),
        extraTypes: {
            script: () => {
                pushHistory({ type: "script", folder, script, args });
            },
        },
    });
}

if (folder) {
    runScript(folder, script, args);
} else if (!host) {
    setStatus("Host is not specified");
    terminal.write("\r\nERROR: Host is not specified\r\n");
} else {
    connectSSH(host);
}