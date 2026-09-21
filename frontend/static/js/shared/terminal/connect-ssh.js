import { getCredentials } from "../credentials/store.js";
import { pushHistory } from "../history/store.js";
import { openTerminalSocket } from "./socket.js";

export function connectSSH(terminal, setStatus, targetHost) {
    const { username, password } = getCredentials();

    if (!username || !password) {
        setStatus("Credentials are not configured");
        terminal.write("\r\nERROR: SSH credentials are not configured.\r\n");
        return;
    }

    // Recorded now, at the moment we know what's being attempted - the
    // same "intent" timing every other history entry uses (see
    // run-script.js, and the click-time entries in domain/search and
    // common/script_links.js), rather than waiting for the socket to
    // open or for auth to be confirmed.
    pushHistory({ type: "ssh", host: targetHost });

    openTerminalSocket(terminal, setStatus, `/ws/ssh?host=${encodeURIComponent(targetHost)}`, {
        onOpen: (socket) => {
            setStatus(`Authenticating to ${targetHost}...`);
            socket.send(JSON.stringify({ type: "auth", username, password }));
        },
    });
}
