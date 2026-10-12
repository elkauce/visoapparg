"""Convert the official CLI archive to ZIP32 for browser-side personalization.

Retains every file byte and validates CRCs; never exports an account-bound package.
Usage: python scripts/export-elgato-template.py OFFICIAL_PLUGIN
"""
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile

source = Path(sys.argv[1])
with zipfile.ZipFile(source) as archive:
    assert archive.testzip() is None, "Invalid archive CRC"
    entries = [(item.filename, archive.read(item)) for item in archive.infolist()]
    assert not any(name.endswith("account.json") for name, _ in entries), "Personal package cannot be published"
    manifest = json.loads(next(data for name, data in entries if name.endswith("/manifest.json")))
    assert manifest["UUID"] == "com.viso.deck" and manifest["Version"] == "1.2.0.0"
    assert sum(len(data) for _, data in entries) < 4 * 1024 * 1024
buffer = io.BytesIO()
with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=False) as archive:
    for name, data in entries:
        archive.writestr(name, data)
result = buffer.getvalue()
with zipfile.ZipFile(io.BytesIO(result)) as archive:
    assert archive.testzip() is None
    assert [(name, archive.read(name)) for name, _ in entries] == entries
root = Path(__file__).resolve().parent.parent
for location in ["public/downloads", "downloads"]:
    target = root / location / "VISO-Elgato-1.2.streamDeckPlugin"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(result)
    if location == "downloads":
        target.with_name(target.name + ".sha256").write_text(hashlib.sha256(result).hexdigest() + "  " + target.name + "\n")
print("Public ZIP32 template verified: identical plugin files, valid CRCs, no account credentials.")
