// Small WebSocket helper shared by every feature that talks to the
// backend over a socket (SSH terminal, script terminal, headless PC
// search): builds the ws(s):// URL and dispatches parsed JSON messages
// by their "type" field, so each caller only has to describe what it
// cares about instead of re-implementing the same onmessage plumbing.

export function wsUrl(path) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}${path}`;
}

// handlers:
//   binaryType              - set on the socket before it opens (e.g. "arraybuffer")
//   types                   - { [messageType]: (message, socket) => void } for
//                              parsed JSON messages, keyed by message.type
//   onRaw(text, socket)     - for string frames that aren't JSON
//   onBinary(buffer, socket)- for binary frames
//   onOpen/onError/onClose  - standard socket lifecycle callbacks, each (socket) => void
export function openTypedSocket(path, {
    binaryType,
    types = {},
    onRaw,
    onBinary,
    onOpen,
    onError,
    onClose,
} = {}) {
    const socket = new WebSocket(wsUrl(path));

    if (binaryType) {
        socket.binaryType = binaryType;
    }

    socket.onmessage = (event) => {
        if (typeof event.data === "string") {
            let message;
            try {
                message = JSON.parse(event.data);
            } catch {
                onRaw?.(event.data, socket);
                return;
            }

            types[message.type]?.(message, socket);
            return;
        }

        if (event.data instanceof ArrayBuffer) {
            onBinary?.(event.data, socket);
        }
    };

    socket.onopen = () => onOpen?.(socket);
    socket.onerror = () => onError?.(socket);
    socket.onclose = (event) => {
        if (event.code === 4401) {
            window.location.replace("/login");
            return;
        }
        if (event.code === 4403) {
            window.location.replace("/stub");
            return;
        }
    onClose?.(socket);
    };
    return socket;
}
