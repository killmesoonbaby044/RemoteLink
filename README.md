# SSH Terminal

Web-based SSH client (xterm.js + FastAPI + asyncssh), plus a page for
running stored scripts through the same terminal view.

## Layout

```
main.py                 thin entry point -> uvicorn main:app --reload
backend/
    main.py              FastAPI() app, mounts static, includes routers
    config.py             paths (STATIC_DIR, TEMPLATES_DIR, SCRIPTS_DIR)
    templating.py          shared Jinja2Templates instance
    routers/
        pages.py            HTML page routes (/, /terminal, /scripts, /credentials)
        ssh_ws.py            /ws/ssh  - interactive SSH session over a WebSocket
        script_ws.py          /ws/script - runs a stored script via subprocess.run
    services/
        ssh_session.py        SSHSession class (asyncssh connect + IO relay)
        process_session.py     ProcessSession class (PTY-backed local script + IO relay)
        script_runner.py       list/resolve script files, path-traversal guard
        io_relay.py             shared "stop as soon as either side finishes" helper
app/
    static/                app.js, index.js, style.css
    templates/              base.html, index.html, terminal.html, scripts.html
scripts/                  drop .sh / .py files here to run them from /scripts
```

## Run

```
pip install -r requirements.txt
uvicorn main:app --reload
```

## Notes

- `credentials.html` wasn't in the files provided, so it isn't included
  here -- drop your existing copy into `app/templates/`.
- Scripts run inside a PTY (`subprocess.Popen` attached to a
  pseudo-terminal, `backend/services/process_session.py`), not
  `subprocess.run`. That's what makes them fully interactive: a
  script can `read`/`input()` a value, branch on it, shell out to
  another script, or open its own nested SSH connection that needs a
  real controlling terminal -- all streamed live through the same
  terminal view used for SSH.
- Script names are resolved against `scripts/` with a path-traversal
  check, but there's no auth on `/scripts` or `/ws/script`. Since
  scripts now get a full interactive shell (not just a fire-and-forget
  run), that's effectively "run any command as this server's user" --
  add auth before exposing this beyond a trusted network.
