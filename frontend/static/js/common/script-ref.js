// A "script ref" packs a script path/name together with an optional
// argument (e.g. a target PC name) into the single opaque `script` query
// value that /terminal and /ws/script forward straight through. "|" is
// invalid in Windows path segments, so it's a safe, reversible delimiter.
// This is the one place that convention is implemented.

const DELIMITER = "|";

export function packScriptRef(path, arg) {
    return arg ? `${path}${DELIMITER}${arg}` : path;
}

export function unpackScriptRef(ref) {
    const index = ref.indexOf(DELIMITER);

    if (index === -1) {
        return { path: ref, arg: null };
    }

    return {
        path: ref.slice(0, index),
        arg: ref.slice(index + 1),
    };
}

// Human-friendly label for UI (tab titles, etc.) -- prefers the argument
// (usually the target PC name) since that's what identifies the session
// to a person; falls back to the plain script name otherwise.
export function scriptRefLabel(ref) {
    const { path, arg } = unpackScriptRef(ref);

    if (arg) {
        return arg;
    }

    const segments = path.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] || path;
}
