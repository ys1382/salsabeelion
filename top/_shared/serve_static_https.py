#!/usr/bin/env python3
"""Static file server with optional TLS. Usage:
   serve_static_https.py PORT DIRECTORY [KEY_PEM CERT_PEM] [BIND]
   BIND defaults to '' (all interfaces)."""
import http.server
import os
import ssl
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
DIRECTORY = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.getcwd()
KEY_PEM = sys.argv[3] if len(sys.argv) > 3 else None
CERT_PEM = sys.argv[4] if len(sys.argv) > 4 else None
BIND = sys.argv[5] if len(sys.argv) > 5 else ""


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)


if __name__ == "__main__":
    server = http.server.HTTPServer((BIND or "", PORT), Handler)
    if KEY_PEM and CERT_PEM and os.path.isfile(KEY_PEM) and os.path.isfile(CERT_PEM):
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(CERT_PEM, KEY_PEM)
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
        scheme = "https"
    else:
        scheme = "http"
    addr = BIND or "0.0.0.0"
    print(f"Serving {DIRECTORY} at {scheme}://{addr}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
