const terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,
    fontSize: 16,
    rows: 30,
    cols: 120,
});

terminal.open(document.getElementById("terminal"));

const status = document.getElementById("status");

const params = new URLSearchParams(window.location.search);

const host = params.get("host");
const script = params.get("script");


function setStatus(text) {
    status.textContent = text;
}

function wsUrl(path) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}${path}`;
}

function handleSocketMessage(event) {
    if (typeof event.data === "string") {
        try {
            const message = JSON.parse(event.data);

            if (message.type === "status") {
                setStatus(message.message);
                return;
            }

            if (message.type === "error") {
                terminal.write(`\r\nERROR: ${message.message}\r\n`);
                setStatus("Error");
                return;
            }
        } catch {
            terminal.write(event.data);
        }

        return;
    }

    if (event.data instanceof ArrayBuffer) {
        const text = new TextDecoder("utf-8").decode(event.data);
        terminal.write(text);
    }
}

// Shared by both SSH and script sessions: both are just a WebSocket
// that streams terminal bytes in and takes raw keystrokes back.
function attachSession(socket) {
    socket.binaryType = "arraybuffer";

    socket.onmessage = handleSocketMessage;

    socket.onerror = () => {
        setStatus("WebSocket error");
        terminal.write("\r\nWebSocket error\r\n");
    };

    socket.onclose = () => {
        setStatus("Disconnected");
        terminal.write("\r\nConnection closed\r\n");
    };

    terminal.onData((data) => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(data);
        }
    });
}

function connectSSH(host) {
    const username = localStorage.getItem("ssh_username");
    const password = localStorage.getItem("ssh_password");

    if (!username || !password) {
        setStatus("Credentials are not configured");
        terminal.write("\r\nERROR: SSH credentials are not configured.\r\n");
        return;
    }

    const socket = new WebSocket(wsUrl(`/ws/ssh?host=${encodeURIComponent(host)}`));
    attachSession(socket);

    socket.onopen = () => {
        setStatus(`Authenticating to ${host}...`);
        socket.send(JSON.stringify({ type: "auth", username, password }));
    };
}

function runScript(name) {
    // Fully interactive: the server runs this script inside a PTY, so
    // prompts, typed input, and keystrokes flow both ways in real
    // time, same as an SSH session.
    const socket = new WebSocket(wsUrl(`/ws/script?name=${encodeURIComponent(name)}`));
    attachSession(socket);

    socket.onopen = () => {
        setStatus(`Starting ${name}...`);
    };
}


if (script) {
    runScript(script);
} else if (!host) {
    setStatus("Host is not specified");
    terminal.write("\r\nERROR: Host is not specified\r\n");
} else {
    connectSSH(host);
}
