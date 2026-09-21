(() => {
    const LOGIN_URL = "/login";
    const AUTH_ENDPOINT = "/auth";

    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url;

        if (url && url.endsWith(AUTH_ENDPOINT)) {
            return response; // login.js reads and displays its own 401/403
        }

        if (response.status === 401 || response.status === 403) {
            window.location.replace(LOGIN_URL);
            return response;
        }

        return response;
    };
})();