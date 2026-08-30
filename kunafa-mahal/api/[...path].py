import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server import Handler, _ensure_runtime, _load_env  # noqa: E402

_load_env()
_ensure_runtime()


class handler(Handler):
    pass
