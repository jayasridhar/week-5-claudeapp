from http.server import BaseHTTPRequestHandler
import importlib.util
import json
from pathlib import Path
import sys
import traceback


def load_normalizer():
    module_path = Path.cwd() / "scripts" / "financial_normalizer.py"
    if not module_path.exists():
        module_path = Path(__file__).resolve().parents[1] / "scripts" / "financial_normalizer.py"

    spec = importlib.util.spec_from_file_location("financial_normalizer", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load financial normalizer module.")

    module = importlib.util.module_from_spec(spec)
    sys.modules["financial_normalizer"] = module
    spec.loader.exec_module(module)
    return module


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")

            text = payload.get("fileText") or ""
            file_name = payload.get("fileName") or ""
            if not text.strip():
                self._send_json(400, {"error": "fileText is required."})
                return

            normalizer = load_normalizer()
            parsed = normalizer.parse_financials(text, file_name)
            content = normalizer.build_content(parsed)
            self._send_json(200, {"content": content})
        except Exception as exc:
            print(traceback.format_exc(), file=sys.stderr)
            self._send_json(500, {"error": str(exc) or "Python normalizer failed."})

