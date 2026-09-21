import { pushHistory } from "../history/store.js";
import { buildScriptSocketPath } from "../../common/script-ref.js";
import { openTerminalSocket } from "./socket.js";

export function runScript(terminal, setStatus, folder, script, args) {
    // Recorded now, at the moment we know what's being attempted - see
    // the note in connect-ssh.js. Previously this waited for the
    // server's "script" message confirming the run had actually
    // started; that message carried nothing else worth acting on, so
    // there's no longer a reason to listen for it here at all.
    pushHistory({ type: "script", folder, script, args });

    // Fully interactive: the server runs this script inside a PTY, so
    // prompts, typed input, and keystrokes flow both ways in real time,
    // same as an SSH session.
    openTerminalSocket(terminal, setStatus, buildScriptSocketPath(folder, script, args), {
        onOpen: () => setStatus(`Starting ${script}...`),
    });
}
