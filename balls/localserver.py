from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn

# This MixIn upgrades the server to handle each request in a separate thread
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    allow_reuse_address = True

class SecurityHeaderHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Mandatory isolation headers for FFmpeg.wasm
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        super().end_headers()

if __name__ == '__main__':
    server_address = ('127.0.0.1', 8000)
    # Use the new Threaded version instead of standard HTTPServer
    httpd = ThreadedHTTPServer(server_address, SecurityHeaderHandler)
    print("Multi-threaded server running at http://127.0.0.1:8000 ...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down.")
        httpd.server_close()
