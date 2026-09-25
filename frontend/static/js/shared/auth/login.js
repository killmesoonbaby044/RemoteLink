// login.js — posts the login form to /auth as JSON

const form = document.getElementById("login-form");
const submitButton = document.getElementById("login-submit");
const statusEl = document.getElementById("login-status");

function setStatus(message, type) {
    statusEl.textContent = message || "";
    statusEl.classList.remove("is-error", "is-success");
    if (type) {
        statusEl.classList.add(type === "error" ? "is-error" : "is-success");
    }
}

// If we got here via a 401/403 redirect (from the middleware or the
// fetch/WS auth handlers), show that reason once, then clean the URL so
// a refresh doesn't keep re-showing it.
const redirectParams = new URLSearchParams(window.location.search);
const redirectReason = redirectParams.get("error");
if (redirectReason) {
    setStatus(redirectReason, "error");
    window.history.replaceState({}, "", window.location.pathname);
}

async function handleSubmit(event) {
    event.preventDefault();

    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;

    if (!username || !password) {
        setStatus("Username and password are required.", "error");
        return;
    }

    submitButton.disabled = true;
    setStatus("Signing in…");

    try {
        const response = await fetch("/auth", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, password }),
        });

        let data = {};
        try {
            data = await response.json();
        } catch (parseError) {
            data = {};
        }

        if (!response.ok) {
            setStatus(data.detail || data.error || data.message || "Invalid username or password.", "error");
            submitButton.disabled = false;
            return;
        }

        setStatus("Signed in.", "success");
        window.location.href = data.redirect || "/";
    } catch (networkError) {
        setStatus("Could not reach the server. Please try again.", "error");
        submitButton.disabled = false;
    }
}

form.addEventListener("submit", handleSubmit);