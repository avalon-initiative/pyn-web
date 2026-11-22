#!/usr/bin/env python3
"""Stub pyn-server for the image smoke test: echoes request headers, streams on /v1/stream, counts uploaded bytes.

Usage: stub-api.py [port [name [cert key]]]. Every reply names the stub (X-Stub). /readyz answers 200 or 503 as set by
/_ctl/ready/0 and /_ctl/ready/1, /_ctl/stats counts requests per path, and POST /v1/drop reads some of the body and closes.
With a cert and key it serves https.
"""
import json
import ssl
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


NAME = "stub"
READY = True
STATS = {}
LOCK = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def count(self):
        with LOCK:
            key = self.command + " " + self.path.split("?")[0]
            STATS[key] = STATS.get(key, 0) + 1

    def reply(self, body, status=200):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("X-Stub", NAME)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        global READY
        if self.path.startswith("/_ctl/"):
            if self.path.endswith("/stats"):
                return self.reply(STATS)
            READY = self.path.endswith("/1")
            return self.reply({"ready": READY})
        self.count()
        if self.path == "/readyz":
            return self.reply({"status": "ok" if READY else "unavailable", "server": NAME}, 200 if READY else 503)
        if self.path.startswith("/v1/stream"):
            self.send_response(200)
            self.send_header("X-Stub", NAME)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            for i in range(3):
                chunk = b"tick%d\n" % i
                self.wfile.write(b"%x\r\n%s\r\n" % (len(chunk), chunk))
                self.wfile.flush()
                time.sleep(1)
            self.wfile.write(b"0\r\n\r\n")
            return
        self.reply({"path": self.path, "server": NAME, "headers": dict(self.headers.items())})

    def do_POST(self):
        self.count()
        if self.path == "/v1/drop":
            self.rfile.read(1024)
            self.close_connection = True
            self.connection.close()
            return
        got = 0
        if self.headers.get("Transfer-Encoding", "").lower() == "chunked":
            while True:
                size = int(self.rfile.readline().split(b";")[0], 16)
                if size == 0:
                    self.rfile.readline()
                    break
                got += len(self.rfile.read(size))
                self.rfile.readline()
        else:
            left = int(self.headers.get("Content-Length", 0))
            while left > 0:
                chunk = self.rfile.read(min(1 << 20, left))
                if not chunk:
                    break
                got += len(chunk)
                left -= len(chunk)
        self.reply({"got": got, "server": NAME, "headers": dict(self.headers.items())})

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    NAME = sys.argv[2] if len(sys.argv) > 2 else "stub"
    server = ThreadingHTTPServer(("0.0.0.0", int(sys.argv[1]) if len(sys.argv) > 1 else 8080), Handler)
    if len(sys.argv) > 4:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(sys.argv[3], sys.argv[4])
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
    server.serve_forever()
