import { getCredentials, saveCredentials } from "./common/credentials.js";

const form = document.getElementById("credentials-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const status = document.getElementById("credentials-status");

const { username: savedUsername, password: savedPassword } = getCredentials();

if (savedUsername) {
    usernameInput.value = savedUsername;
}

if (savedPassword) {
    passwordInput.value = savedPassword;
}

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
        return;
    }

    saveCredentials(username, password);

    status.textContent = "Credentials saved.";
    window.location.replace("/");
});
