// Shared by both SSH and script sessions: both are just a WebSocket that
// streams terminal bytes in and takes raw keystrokes back. This is the
// one place "connect to ws" happens for the terminal page -
// connect-ssh.js/run-script.js only differ in the URL and what they do
// on open. Built on common/ws.js's generic typed-message socket, which
// stays in common/ since it's meant for any feature that talks to the
// backend over a socket, not just this one.

import { openTypedSocket } from "../../common/ws.js";

export function openTerminalSocket(terminal, setStatus, path, { onOpen } = {}) {
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
        },
    });

    terminal.onData((data) => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(data);
        }
    });

    return socket;
}
