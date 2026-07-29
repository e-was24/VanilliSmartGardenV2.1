import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run_command(cmd, cwd):
    return subprocess.Popen(
        cmd,
        cwd=str(cwd),
        shell=True,
        creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0,
    )


if __name__ == "__main__":
    print("Starting Python face verification service...")
    py_proc = run_command(f'"{sys.executable}" -m uvicorn main:app --host 127.0.0.1 --port 8000', ROOT)
    time.sleep(1)
    print("Starting Node backend...")
    js_proc = run_command('node server.js', ROOT)

    def stop_all(signum, frame):
        for proc in (py_proc, js_proc):
            if proc.poll() is None:
                proc.terminate()
        raise SystemExit(0)

    signal.signal(signal.SIGINT, stop_all)
    signal.signal(signal.SIGTERM, stop_all)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        stop_all(None, None)
