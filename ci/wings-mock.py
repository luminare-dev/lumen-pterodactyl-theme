"""CI only: a stand-in for the Wings daemon, so the screenshots show a running server.

Answers the few HTTP calls the panel makes for the pages we screenshot (server details, file
list, system info) and speaks enough of the console websocket protocol (auth, status, console
output, stats). Python standard library only; listens on 0.0.0.0:8443. Invented data only.
"""

import asyncio
import base64
import hashlib
import json
import struct
import time
from urllib.parse import urlsplit

PORT = 8443
START = time.time()
LOG = [
    "\u001b[33m[12:00:00 INFO]: \u001b[0mStarting minecraft server version 1.21.4",
    "[12:00:00 INFO]: Loading properties",
    "[12:00:00 INFO]: Default game type: SURVIVAL",
    "[12:00:01 INFO]: Preparing level \"world\"",
    "[12:00:02 INFO]: Preparing spawn area: 100%",
    "\u001b[32m[12:00:02 INFO]: Done (2.412s)! For help, type \"help\"\u001b[0m",
    "[12:01:14 INFO]: Mira joined the game",
    "[12:01:30 INFO]: <Mira> hello world",
    "[12:02:05 INFO]: Jonas joined the game",
    "[12:04:41 INFO]: Saved the game",
]
FILES = [
    ("config", 0, False, "inode/directory"),
    ("logs", 0, False, "inode/directory"),
    ("plugins", 0, False, "inode/directory"),
    ("world", 0, False, "inode/directory"),
    ("world_nether", 0, False, "inode/directory"),
    ("banned-players.json", 2, True, "application/json"),
    ("eula.txt", 158, True, "text/plain"),
    ("ops.json", 112, True, "application/json"),
    ("paper.jar", 51_380_224, True, "application/java-archive"),
    ("server.properties", 1_342, True, "text/plain"),
    ("whitelist.json", 96, True, "application/json"),
]
CORS = (
    "Access-Control-Allow-Origin: *\r\n"
    "Access-Control-Allow-Headers: Authorization, Content-Type, Accept\r\n"
    "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
)


def stats():
    t = time.time() - START
    return {
        "memory_bytes": int(1_650_000_000 + 120_000_000 * ((t % 20) / 20)),
        "memory_limit_bytes": 4_294_967_296,
        "cpu_absolute": round(18 + 9 * ((t * 7) % 10) / 10, 2),
        "network": {"rx_bytes": int(48_000_000 + t * 9000), "tx_bytes": int(91_000_000 + t * 15000)},
        "state": "running",
        "disk_bytes": 2_180_000_000,
        "uptime": int(t * 1000) + 5_400_000,
    }


def file_list():
    now = "2026-11-20T10:15:00+00:00"
    return [
        {
            "name": name,
            "created": now,
            "modified": now,
            "mode": "-rw-r--r--" if is_file else "drwxr-xr-x",
            "mode_bits": "644" if is_file else "755",
            "size": size,
            "directory": not is_file,
            "file": is_file,
            "symlink": False,
            "mime": mime,
        }
        for name, size, is_file, mime in FILES
    ]


async def send_frame(writer, payload: str):
    data = payload.encode()
    header = bytearray([0x81])
    if len(data) < 126:
        header.append(len(data))
    elif len(data) < 65536:
        header.append(126)
        header += struct.pack(">H", len(data))
    else:
        header.append(127)
        header += struct.pack(">Q", len(data))
    writer.write(bytes(header) + data)
    await writer.drain()


async def read_frame(reader):
    head = await reader.readexactly(2)
    opcode = head[0] & 0x0F
    length = head[1] & 0x7F
    if length == 126:
        length = struct.unpack(">H", await reader.readexactly(2))[0]
    elif length == 127:
        length = struct.unpack(">Q", await reader.readexactly(8))[0]
    mask = await reader.readexactly(4) if head[1] & 0x80 else b"\0\0\0\0"
    data = bytes(b ^ mask[i % 4] for i, b in enumerate(await reader.readexactly(length)))
    return opcode, data


async def websocket(reader, writer, key):
    accept = base64.b64encode(hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()).decode()
    writer.write(
        (
            "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
        ).encode()
    )
    await writer.drain()

    async def ticker():
        while True:
            await asyncio.sleep(2)
            await send_frame(writer, json.dumps({"event": "stats", "args": [json.dumps(stats())]}))

    task = None
    try:
        while True:
            opcode, data = await read_frame(reader)
            if opcode == 8:
                break
            if opcode == 9:
                writer.write(b"\x8a\x00")
                continue
            try:
                message = json.loads(data)
            except ValueError:
                continue
            event = message.get("event")
            if event == "auth":
                await send_frame(writer, json.dumps({"event": "auth success"}))
                await send_frame(writer, json.dumps({"event": "status", "args": ["running"]}))
                if task is None:
                    task = asyncio.create_task(ticker())
            elif event == "send logs":
                for line in LOG:
                    await send_frame(writer, json.dumps({"event": "console output", "args": [line]}))
            elif event == "send stats":
                await send_frame(writer, json.dumps({"event": "stats", "args": [json.dumps(stats())]}))
    except (asyncio.IncompleteReadError, ConnectionError):
        pass
    finally:
        if task:
            task.cancel()
        writer.close()


async def handle(reader, writer):
    try:
        request = await reader.readuntil(b"\r\n\r\n")
    except (asyncio.IncompleteReadError, asyncio.LimitOverrunError):
        writer.close()
        return
    lines = request.decode(errors="replace").split("\r\n")
    method, target, _ = (lines[0].split(" ") + ["", "", ""])[:3]
    headers = {}
    for line in lines[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    path = urlsplit(target).path
    if headers.get("upgrade", "").lower() == "websocket":
        await websocket(reader, writer, headers.get("sec-websocket-key", ""))
        return
    length = int(headers.get("content-length", "0") or 0)
    if length:
        await reader.readexactly(length)

    status, body = "200 OK", {}
    if method == "OPTIONS":
        status, body = "204 No Content", None
    elif path == "/api/system":
        body = {"architecture": "amd64", "cpu_count": 8, "kernel_version": "6.8.0", "os": "linux", "version": "1.11.13"}
    elif path.endswith("/files/list-directory"):
        body = file_list()
    elif path.startswith("/api/servers/") and path.count("/") == 3:
        body = {"state": "running", "is_suspended": False, "utilization": stats()}
    elif method == "POST":
        status, body = "204 No Content", None
    else:
        status, body = "404 Not Found", {"error": "not mocked"}

    payload = b"" if body is None else json.dumps(body).encode()
    writer.write(
        (
            f"HTTP/1.1 {status}\r\nContent-Type: application/json\r\n{CORS}"
            f"Content-Length: {len(payload)}\r\nConnection: close\r\n\r\n"
        ).encode()
        + payload
    )
    await writer.drain()
    writer.close()


async def main():
    server = await asyncio.start_server(handle, "0.0.0.0", PORT)
    print(f"wings mock on :{PORT}", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
