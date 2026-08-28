import { openTypedSocket } from "./common/ws.js";
import { pushHistory } from "./common/history.js";
import { getCredentials } from "./common/credentials.js";
import { scriptRefLabel } from "./common/script-ref.js";

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
const host = params.get("host");
const script = params.get("script");

function setStatus(text) {
    statusEl.textContent = text;
}

// The server already renders a host/script-aware <title> (see
// terminal.html), this just refines it once the script's packed
// "path|arg" ref is available client-side, since the target PC name
// (the arg) is usually more useful in a tab than the raw script path.
if (script) {
    document.title = scriptRefLabel(script);
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
        },
    });
}

function runScript(name) {
    // Fully interactive: the server runs this script inside a PTY, so
    // prompts, typed input, and keystrokes flow both ways in real time,
    // same as an SSH session.
    openTerminalSocket(`/ws/script?name=${encodeURIComponent(name)}`, {
        onOpen: () => setStatus(`Starting ${name}...`),
        extraTypes: {
            script: (message) => {
                pushHistory({ type: "script", path: message.path, name: message.name });
            },
        },
    });
}

if (script) {
    runScript(script);
} else if (!host) {
    setStatus("Host is not specified");
    terminal.write("\r\nERROR: Host is not specified\r\n");
} else {
    connectSSH(host);
}
