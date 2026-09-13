import json
import os
import getpass
import ipaddress
import socket

from app.config import IP_MAP_FILE


def is_port_free(ip: str) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind((ip, 80))
        return True
    except OSError:
        return False
    finally:
        s.close()


BASE_IP = ipaddress.ip_address("127.0.0.2")


def _load_map() -> dict:
    if not os.path.exists(IP_MAP_FILE):
        return {}
    try:
        with open(IP_MAP_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _save_map(data: dict) -> None:
    with open(IP_MAP_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def get_app_ip() -> str:
    user = getpass.getuser()
    ip_map = _load_map()

    if user in ip_map:
        return ip_map[user]

    used_ips = set(ip_map.values())
    candidate = BASE_IP
    while str(candidate) in used_ips:
        candidate += 1

    ip_map[user] = str(candidate)
    _save_map(ip_map)
    return str(candidate)
