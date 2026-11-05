# RemoteLink

A browser-based admin console for support/ops staff. One web app, three areas:

- **Domain** — search Active Directory users and PCs, run scoped scripts against them, add users, browse the OU tree.
- **Network** — SSH to a device, find a MAC address across the switch inventory, view and change Cisco switch interfaces.
- **Inventory** — the switch inventory (root points → groups → hosts) and the AD OU tree.

Interactive work (SSH sessions, scripts that prompt) is streamed live into an [xterm.js](https://xtermjs.org/) terminal over a WebSocket. Non-interactive work (searches, lookups, interface changes) goes through JSON endpoints.

Developed on macOS, deployed on Windows: the domain scripts are `.ps1` / `.cmd`.

## Features

### Domain (`/domain`)
- **Search users / Search PC** — runs `scripts/root/search_users.ps1` / `search_pcs.ps1`, which print a JSON array. Picking a result reveals the scripts in `scripts/user/` or `scripts/pc/`, pre-filled with the picked name.
- **Add user** (`/domain/add_user`) — form, or upload a `.doc`/`.docx` to pre-fill it; runs `scripts/domain/create_user.ps1`. The OU picker remembers recent picks.
- **Domain inventory** (`/domain/inventory`) — the OU tree, synced from AD with `scripts/domain/get_schema.ps1` and cached in SQLite. Each OU row expands to the users in it (`users_by_OU.ps1`).

### Network (`/switch`)
A hub page with three tools:
- **Connect to device** (`/switch/connect`) — interactive SSH terminal to any host (`asyncssh`).
- **MAC lookup** (`/switch/lookup`) — finds a MAC (or its last hex characters) in the static / dynamic / port-security MAC tables of every switch under a root point or group, concurrently.
- **Interface config** (`/switch/interface`) — for Cisco IOS switches:
  1. pick a switch from the inventory tree (or search by name/address);
  2. pick an interface from `show interfaces status`;
  3. the form is pre-filled from `show running-config interface X`. Only fields you change are sent; a cleared field sends `no …`.
  - **Access ports:** description, access VLAN, mode access, port-security (*On + sticky MAC* / *On* / *Off*), port-security maximum, free-text extra lines, and clicking a running-config line to remove it. One-click **Enable / Disable / Restart**, **Clear sticky MACs**, **Reset port-security** (each confirms first).
  - **Trunk ports:** description and add/remove allowed VLANs only. A port counts as a trunk if it has `switchport mode trunk` **or** `show interfaces X switchport` reports *Operational Mode: trunk* (DTP-negotiated trunks, port-channel members). If that mode can't be read, the port is treated as a trunk (locked).
  - **Preview** shows the exact commands → **Run** sends them in one SSH session and shows the new `show run int` → **Save** (`write memory`) or **Revert** (back to the config from before the run). A header **Save switch config** button turns blue while the running-config has unsaved changes.

### Inventory (`/inventory_hub`)
- **Network inventory** (`/switch/inventory`) — CRUD for hosts, groups (can nest) and root points, plus a read-only hierarchy view. Stored in SQLite.
- **Domain inventory** — see above.

### Shared
- **Credentials** (`/credentials`) — the SSH username/password, entered once and reused for SSH, MAC lookup and interface config. Kept in the browser's `localStorage`, not on the server.
- **History** — recent SSH connections, script runs and searches, in the header dropdown and as autosuggest.

## How it works

### Terminal sessions
SSH sessions and interactive scripts use the same model: the backend opens either an SSH connection (`asyncssh`) or a local process in a PTY (`ptyprocess` on macOS/Linux, `pywinpty` on Windows), then relays raw bytes between it and a browser WebSocket (`io_relay.relay`) until either side closes.

- `/ssh_terminal?host=<host>` → WebSocket `/ws/ssh`, which expects `{type: "auth", username, password}` first.
- `/terminal?folder=<f>&script=<name>` → WebSocket `/ws/script`, which resolves the script inside `scripts/<folder>/` (rejecting path traversal) and runs `.ps1` with `powershell` and `.cmd` with `cmd /c`.

### Switch tasks
`app/services/switch/runtime.py` opens one SSH session per switch, writes a short scripted command list (`terminal length 0`, the commands, `exit`) and returns the transcript. Task modules only decide what to send and how to read the answer:

- `run_on_group` — every host under a group/root point, concurrently (MAC lookup). A failed host becomes a per-host error in the result.
- `run_on_host` — one switch by inventory name (interface config). A failed connection raises `SwitchConnectionError` → HTTP 502.

Interface changes are checked against the switch, not the page: before building commands the backend re-reads the interface's running config, so trunk/access rules and "remove this line" use the current state. Input is validated so nothing typed on the page can become a second IOS command (no newlines, no `?`, strict interface-name and VLAN-list formats).

### Authentication
- Login (`/login` → `POST /auth`) is delegated to an external auth service (`AUTH_API`), which checks the user against LDAP and returns a JWT. The app stores it as an HTTP-only cookie.
- On startup the app registers itself with that service (`/register`) with the OS user and a random instance ID. A token is only accepted if it was issued for this instance and this owner.
- Pages and API routes depend on `validate_user`. Failures become JSON `401`/`403`; for real page loads (`Accept: text/html`) `AuthRedirectMiddleware` turns either into a redirect to `/login?error=<reason>`, so the login page can say why.
- `frontend/static/js/shared/auth/redirect.js` patches `window.fetch` to redirect on `401`/`403` (except for `/auth` itself, so a failed login shows its message).
- WebSockets authenticate right after `accept()` (`authenticate_websocket`) and close with `4401` / `4403`; `common/ws.js` redirects on those codes.

### Errors
Each service keeps its exceptions in its own module and `app/core/exception_handlers.py` maps them to HTTP status codes. Routes don't catch them.

| Exception | Status |
|---|---|
| `AuthenticationError` / `UserDisabledError` | 401 / 403 |
| `InventoryError`: `NotFoundError` / `ConflictError` / other | 404 / 409 / 400 |
| `SwitchTaskError`: `SwitchConnectionError` / `InterfaceChangeRejected` / other | 502 / 409 / 400 |
| `InvalidScriptError` / `FileCheckError` | 404 / 400 |

## Project structure

```
main.py                         FastAPI app, middleware, routers; picks a per-user loopback IP and runs uvicorn
app/
  config.py                     paths (scripts/, storage/, templates), Jinja2 templates instance
  settings.py                   .env settings (auth service, JWT)
  ip_app_resolve.py             per-OS-user loopback IP (127.0.0.2, .3, …) saved in storage/ip_map.json
  core/
    auth/                       validate_user, authenticate_websocket, auth exceptions
    client/http.py              HTTP client for the auth service
    database/blob_store.py      SQLite JSON blob store (WAL, atomic read-modify-write)
    exception_handlers.py       exception -> HTTP status mapping
    lifespan.py                 startup registration with the auth service
    middleware.py               AuthRedirectMiddleware
  routers/
    login.py                    /login, /auth
    pages/                      HTML pages: app.py (/, hubs, credentials, terminals), domain.py, switches.py
    ssh_ws.py, script_ws.py     /ws/ssh, /ws/script
    domain_scripts.py           /domain/* JSON endpoints (search, add user, OU tree sync)
    switch_inventory.py         /switch/inventory/* CRUD
    switch_tasks.py             /switch/tasks/* (MAC lookup, interface config)
  services/
    sessions/                   terminal bridges: ssh_session, process_session (PTY), io_relay;
                                AD_script_session (run a script to completion, capture output)
    domain/                     AD search, OU tree sync, .doc parsing, script resolution
    switch/
      schemas.py                shared models: Host, Group, RootPoint, SwitchRequest, results
      errors.py                 SwitchTaskError, SwitchConnectionError, InterfaceChangeRejected
      runtime.py                SSH runner: run_commands, run_on_group, run_on_host
      inventory/                inventory store + service (root points, groups, hosts)
      mac_lookup/               schemas, parsing (MAC filter + table parser), tasks
      interface/                schemas (+ input checks), parsing (show output),
                                commands (apply / revert / action builders), tasks
frontend/                       see frontend/README.md (JS layout) and
                                frontend/static/css/README.md (UI style guide)
  template/                     Jinja2: base.html, macros/, pages/{domain,switch}/
  static/                       js/ (ES modules, no build step), css/, vendor/xterm.js
scripts/                        runnable scripts (see below)
storage/                        created at runtime: inventory.db (SQLite), ip_map.json
```

Feature folders follow one shape on both sides: on the backend `schemas` / `parsing` / `commands` / `tasks`, on the frontend `config` / `dom` / `api` / `render` / `main` (see `frontend/README.md`).

## Requirements

- Python 3.12, [uv](https://docs.astral.sh/uv/)
- Dependencies in `pyproject.toml` (`fastapi`, `uvicorn`, `asyncssh`, `ptyprocess`, `pydantic-settings`, `python-jose`, `python-docx`, …)
- On Windows also `pywinpty` (PTY for interactive scripts) — see Known gaps
- A running auth service (see `.env` below) — the app registers with it on startup and logs in through it

## Getting started

1. Install dependencies:
   ```bash
   uv sync
   ```
2. Create `.env` in the project root:
   ```
   AUTH_API=https://auth.example.local      # auth service base URL
   JWT_ISSUER=...
   JWT_AUDIENCE=...
   JWT_PUB_KEY=...                           # base64 public key used to verify tokens
   JWT_ALGORITHM=ES256                       # optional, default ES256
   JWT_EXPIRES=864000                        # optional, cookie lifetime in seconds
   ```
3. Put scripts in `scripts/` (`.ps1` or `.cmd`):
   - `scripts/root/search_users.ps1`, `search_pcs.ps1` — the two searches on `/domain`; print a JSON array.
   - `scripts/user/*`, `scripts/pc/*` — scripts offered after picking a user / PC.
   - `scripts/domain/` — `create_user.ps1`, `get_schema.ps1`, `users_by_OU.ps1` used by the domain pages.
4. Run:
   ```bash
   uv run python main.py
   ```
   The app picks a loopback IP for the current OS user (`127.0.0.2`, `127.0.0.3`, … — so several users on one machine each get their own instance), serves on port 80 and opens the browser. If that IP:80 is already taken, it exits with "App already running for this user."
5. Add switches in **Inventory → Network inventory**, and SSH credentials on **Credentials**.

## Project status / known gaps

- **No automated tests.** Changes have been checked by hand and with throwaway scripts against a fake switch; a `tests/` suite for the switch parsers and command builders would be the cheapest place to start.
- **Interface config is untested on real switches.** All commands are sent in one go without waiting for each prompt. That works for `show` commands, but a slow switch, or a command that asks for confirmation (`clear port-security …` on some IOS versions), could swallow the next line. Check the "Session output" panel the first few times.
- **MAC lookup line format.** The MAC table parser expects the VLAN at the very start of each line. Some IOS versions right-align that column with leading spaces (`  10    0011.2233.4455 …`), which wouldn't match. Worth checking against your switches' output.
- **`pywinpty` is not in `pyproject.toml`.** `process_session.py` imports it on Windows, so interactive scripts need it installed there.
- **SSH credentials live in the browser** (`localStorage`), sent to the server only per request. Fine for an internal tool; revisit before exposing it more widely.
- **`/switch/connect`'s "Run a script" list is always empty** — the page route passes no `scripts` to the template, and nothing calls `initScriptList()` (see `frontend/README.md`).

## License

No license file is included — add one if you plan to share or reuse this code.
