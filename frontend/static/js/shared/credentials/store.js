// SSH credentials are stored client-side in localStorage under these two
// keys; every feature that needs them (connect form, terminal SSH
// connect, the credentials page itself) goes through these three
// functions instead of touching localStorage directly.

const USERNAME_KEY = "ssh_username";
const PASSWORD_KEY = "ssh_password";

export function getCredentials() {
    return {
        username: localStorage.getItem(USERNAME_KEY),
        password: localStorage.getItem(PASSWORD_KEY),
    };
}

export function saveCredentials(username, password) {
    localStorage.setItem(USERNAME_KEY, username);
    localStorage.setItem(PASSWORD_KEY, password);
}

export function hasCredentials() {
    const { username, password } = getCredentials();
    return Boolean(username && password);
}
