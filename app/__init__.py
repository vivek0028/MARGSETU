import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
_backend = _root / "backend"
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

_backend_app = _backend / "app"
if _backend_app.exists() and str(_backend_app) not in __path__:
    __path__.insert(0, str(_backend_app))
