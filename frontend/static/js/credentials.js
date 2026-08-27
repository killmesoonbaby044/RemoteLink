const form = document.getElementById(
    "credentials-form"
);

const usernameInput = document.getElementById(
    "username"
);

const passwordInput = document.getElementById(
    "password"
);

const status = document.getElementById(
    "credentials-status"
);


// Load existing credentials
const savedUsername =
    localStorage.getItem("ssh_username");

const savedPassword =
    localStorage.getItem("ssh_password");


if (savedUsername) {
    usernameInput.value = savedUsername;
}

if (savedPassword) {
    passwordInput.value = savedPassword;
}


// Save credentials
form.addEventListener(
    "submit",
    (event) => {

        event.preventDefault();

        const username =
            usernameInput.value.trim();

        const password =
            passwordInput.value;


        if (!username || !password) {
            return;
        }


        localStorage.setItem(
            "ssh_username",
            username
        );

        localStorage.setItem(
            "ssh_password",
            password
        );


        status.textContent =
            "Credentials saved.";
        window.location.replace('/')
    }
);