const form = document.getElementById(
    "connect-form"
);

const hostInput = document.getElementById(
    "host"
);


form.addEventListener(
    "submit",
    (event) => {

        event.preventDefault();


        const host =
            hostInput.value.trim();


        if (!host) {
            return;
        }


        const username =
            localStorage.getItem("ssh_username");

        const password =
            localStorage.getItem("ssh_password");


        if (!username || !password) {

            window.location.href =
                "/credentials";

            return;
        }


        window.location.href =
            `/terminal?host=${encodeURIComponent(host)}`;
    }
);