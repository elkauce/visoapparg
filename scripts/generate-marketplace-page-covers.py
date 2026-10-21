#!/usr/bin/env python3
"""Page covers now come from actual VISO components, not illustrations.

Start local Vite and set VISO_PLAYWRIGHT_MODULE to an installed Playwright entry.
"""
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parents[1]
subprocess.run(["node", str(root / "scripts/capture-marketplace-pages.mjs")], cwd=root, check=True)
