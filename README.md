# RemoteLink

A browser-based remote administration console. It gives support/ops staff one web page to open an interactive SSH terminal to any host, or run a local admin script against a target — both streamed live into an [xterm.js](https://xtermjs.org/) terminal over a WebSocket.

## Features

- **SSH terminal** — enter a hostname/IP on `/connect` and get a full interactive shell in the browser (`asyncssh` under the hood).
- **Script runner** — runs files from a local `scripts/` folder inside a real PTY (`ptyprocess` on macOS/Linux, `pywinpty` on Windows), so interactive prompts, typed input, and even a script that opens its own nested SSH session all work like a normal terminal.
- **Entity search → scoped scripts** — the home page (`/`) has "Search users" and "Search PC" boxes. Each runs a search script, parses `SEARCH_RESULTS: name1|name2|...` lines out of its output, and lets you pick a result to reveal scripts scoped to that user/PC (`scripts/user/*`, `scripts/pc/*`), pre-filled with the picked name as an argument.
- **Credentials page** — SSH username/password entered once on `/credentials` and reused for every SSH connection (stored in the browser's `localStorage`, not on the server).
- **Connection history** — the last 10 SSH connections and script runs are kept client-side and surfaced as a "History" dropdown in the header and as autosuggest options on the host/search fields.

## How it works

Both SSH sessions and script runs use the same model: the backend opens either a real SSH connection (`asyncssh`) or a local subprocess in a PTY, then relays raw bytes between it and a browser WebSocket (`io_relay.relay`) until either side closes. The frontend points a single `xterm.js` instance at whichever WebSocket the page needs:

- `GET /terminal?host=<host>` → connects to `/ws/ssh`, which expects an `{type: "auth", username, password}` message first.
- `GET /terminal?script=<name>` → connects to `/ws/script?name=<name>`, which resolves `<name>` inside `scripts/` (rejecting path traversal), picks an interpreter by file extension, and spawns it.

## Project structure

```
app/
  config.py                    # paths, SCRIPTS_DIR, SSH_PORT
  templating.py                # shared Jinja2Templates instance
  routers/
    pages.py                   # /, /connect, /credentials, /terminal
    ssh_ws.py                  # /ws/ssh
    script_ws.py                # /ws/script
  services/
    sessions/
      ssh_session.py           # asyncssh <-> WebSocket bridge
      process_session.py       # local PTY <-> WebSocket bridge
      io_relay.py               # shared two-way relay helper
    scripts/
      script_runner.py          # script discovery + interpreter selection
frontend/
  templates/                    # Jinja2 pages, macros, components
  static/
    js/                          # vanilla ES modules, no build step
    css/
    vendor/xterm.js               # bundled xterm.js
scripts/                         # created at runtime; your .cmd/.ps1/.sh/.py files go here
```

## Requirements

- Python 3.12
- `fastapi`, `uvicorn[standard]`, `jinja2`
- `asyncssh` (SSH sessions)
- `ptyprocess` on macOS/Linux **or** `pywinpty` on Windows (local script PTYs)
- `pydantic`, `pydantic-settings`, `loguru`

Only needed by the auth layer below, and not yet exercised by the running app:  `passlib[argon2]`, `python-jose[cryptography]`.

## Getting started

1. Install the core dependencies:
   - install UV on PC than run at project level:
   ```bash
   uv sync
   ```
2. Add scripts to run. `SCRIPTS_DIR` (`scripts/` at the project root) is created automatically on startup; drop files into:
   - `scripts/` — general scripts, listed on `/connect`
   - `scripts/pc/`, `scripts/user/` — scoped scripts shown after a PC/user search on `/`
   - `scripts/root/search_pcs.*` and `scripts/root/search_users.*` — the two search scripts the home page expects (see `pc_search_script`/`user_search_script` in `app/routers/pages.py`); each should print a line like `SEARCH_RESULTS: name1|name2|name3` to stdout.
3. Run it:
   ```bash
   uv run python main.py 
   ```
4. Visit `http://localhost:8000`.

## Project status / known gaps

- **SSH credentials live in the browser.** `/credentials` stores the username/password in plain `localStorage`, sent to the server only when opening a session. Fine for a trusted internal tool; worth revisiting before exposing this more broadly.
- **`/connect`'s "Run a script" list is currently always empty** — `connect_page()` in `app/routers/pages.py` doesn't pass a `scripts` variable into the template, so that section always renders its "No scripts found" state.


## License

No license file is included — add one if you plan to share or reuse this code.
