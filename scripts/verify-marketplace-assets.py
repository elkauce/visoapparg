#!/usr/bin/env python3
"""Check the actual first-party catalog files, formats and animation movement.

Requires Node 24+, Pillow, NumPy, FFmpeg and FFprobe. It does not access network
services, customer data or credentials and never modifies the generated media.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUT = PUBLIC / "marketplace"


def catalog():
    source = (ROOT / "convex/lib/marketplace_catalog.ts").as_uri()
    javascript = (
        f"import {{ BUILTIN_MARKETPLACE_PRODUCTS }} from {json.dumps(source)};"
        "console.log(JSON.stringify(BUILTIN_MARKETPLACE_PRODUCTS));"
    )
    return json.loads(subprocess.check_output(
        ["node", "--input-type=module", "-e", javascript], cwd=ROOT, text=True,
    ))


def local_path(path):
    assert path.startswith("/"), f"Nonlocal first-party path: {path}"
    resolved = (PUBLIC / path.lstrip("/")).resolve()
    assert resolved.is_relative_to(PUBLIC.resolve()), f"Escaping public path: {path}"
    assert resolved.is_file() and resolved.stat().st_size > 0, f"Missing asset: {path}"
    return resolved


def frame_at(path, seconds, width, height):
    raw = subprocess.check_output([
        "ffmpeg", "-loglevel", "error", "-ss", str(seconds), "-i", str(path),
        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ])
    assert len(raw) == width * height * 3, f"Undecodable video frame: {path.name}"
    return np.frombuffer(raw, dtype=np.uint8).astype(np.float32)


def verify():
    products = catalog()
    identifiers = [product["id"] for product in products]
    assert len(identifiers) == len(set(identifiers)), "Repeated product ID"
    assert not any(product["category"] == "used" for product in products), "Fabricated used listing"
    for product in products:
        with Image.open(local_path(product["coverPath"])) as cover:
            cover.verify()

    seen = set()
    image_count = gif_count = video_count = audio_count = 0
    for product in products:
        asset_ids = [asset["id"] for asset in product["assets"]]
        assert len(asset_ids) == len(set(asset_ids)), "Repeated asset ID"
        for asset in product["assets"]:
            path = local_path(asset["builtinPath"])
            if path in seen:
                continue
            seen.add(path)
            mime = asset.get("mimeType")
            if asset["mediaType"] == "image":
                with Image.open(path) as image:
                    assert image.size == ((192, 192) if mime == "image/gif" else (256, 256))
                    if mime == "image/gif":
                        assert image.format == "GIF" and image.n_frames == 12
                        assert image.info.get("loop") == 0, "GIF does not loop"
                        first = np.array(image.convert("RGB"), dtype=np.float32)
                        image.seek(3)
                        high = np.array(image.convert("RGB"), dtype=np.float32)
                        image.seek(9)
                        low = np.array(image.convert("RGB"), dtype=np.float32)
                        assert float(np.mean(np.abs(high - low))) > 1, "GIF is static"
                        assert not np.array_equal(first, high), "GIF does not change"
                        gif_count += 1
                    else:
                        assert image.format == "PNG" and mime == "image/png"
                        image.verify()
                        image_count += 1
            elif asset["mediaType"] == "video":
                assert mime == "video/mp4"
                probe = json.loads(subprocess.check_output([
                    "ffprobe", "-v", "error", "-show_streams", "-show_format",
                    "-of", "json", str(path),
                ], text=True))
                streams = probe["streams"]
                video = [stream for stream in streams if stream["codec_type"] == "video"]
                assert len(video) == 1 and len(streams) == 1, "Video is not silent"
                assert video[0]["codec_name"] == "h264" and video[0]["pix_fmt"] == "yuv420p"
                duration = float(probe["format"]["duration"])
                width, height = video[0]["width"], video[0]["height"]
                expected = (768, 432, 6.0) if product["category"] == "screensavers" else (256, 256, 3.0)
                assert (width, height) == expected[:2] and abs(duration - expected[2]) < .1
                first = frame_at(path, duration / 4, width, height)
                second = frame_at(path, duration * 3 / 4, width, height)
                assert float(np.mean(np.abs(first - second))) > 1, "Video is static"
                video_count += 1
            elif asset["mediaType"] == "audio":
                assert mime == "audio/wav"
                with wave.open(str(path), "rb") as sound:
                    assert sound.getnchannels() == 1 and sound.getsampwidth() == 2
                    assert sound.getframerate() == 22050
                    assert .5 <= sound.getnframes() / sound.getframerate() <= 1
                    pcm = np.frombuffer(sound.readframes(sound.getnframes()), dtype="<i2")
                    assert float(np.sqrt(np.mean(pcm.astype(float) ** 2))) > 300, "Silent sound"
                    assert int(np.max(np.abs(pcm))) < 32767, "Clipped sound"
                audio_count += 1
            else:
                raise AssertionError(f"Unverified first-party asset type: {asset['mediaType']}")

    manifest = json.loads((OUT / "originals-manifest.json").read_text())
    entries = manifest["files"]
    all_media = {path.relative_to(OUT).as_posix() for path in OUT.rglob("*")
                 if path.is_file() and path.name != "originals-manifest.json"}
    assert {entry["path"] for entry in entries} == all_media
    for entry in entries:
        path = OUT / entry["path"]
        assert path.stat().st_size == entry["bytes"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry["sha256"]

    return {
        "products": len(products), "pngKeyFaces": image_count,
        "animatedGIFs": gif_count, "silentH264Videos": video_count,
        "originalWAVSounds": audio_count, "covers": len({p["coverPath"] for p in products}),
        "generatedFiles": len(all_media) + 1,
        "generatedBytes": sum(path.stat().st_size for path in OUT.rglob("*") if path.is_file()),
        "allCatalogPathsExist": True, "animationMovementVerified": True,
        "manifestChecksumsMatch": True,
    }


if __name__ == "__main__":
    print(json.dumps(verify(), indent=2))
