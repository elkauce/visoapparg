#!/usr/bin/env python3
"""Create original illustrative covers for VISO's native page catalogue.

These are labelled illustrations, not simulated live sports/weather data. All
shapes are drawn here; no team marks, album art or third-party artwork is copied.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import math
from pathlib import Path

from PIL import ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/marketplace"
spec = importlib.util.spec_from_file_location("viso_originals", ROOT / "scripts/generate-marketplace-assets.py")
originals = importlib.util.module_from_spec(spec)
spec.loader.exec_module(originals)


def draw_cover(kind, title, subtitle):
    image = originals.cover_base("Página VISO", title, subtitle)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((68, 223, 892, 565), radius=28, fill="#141619")
    if kind == "football":
        draw.rounded_rectangle((91, 248, 419, 536), radius=24, fill="#242529")
        draw.rectangle((122, 278, 388, 506), outline="#56575C", width=2)
        draw.line((255, 278, 255, 506), fill="#56575C", width=2)
        draw.ellipse((209, 348, 301, 440), outline="#56575C", width=2)
        for x, y in [(156, 312), (156, 390), (156, 472), (351, 312), (351, 390), (351, 472)]:
            draw.ellipse((x-8, y-8, x+8, y+8), fill="#22D571" if x < 255 else "#EF4444")
        draw.text((457, 276), "Todos tus partidos", font=originals.font(29, True), fill="white")
        for i, label in enumerate(["Argentina y Latinoamérica", "Favoritos y resultados", "Consulta de fechas anteriores"]):
            draw.text((459, 342 + i * 57), label, font=originals.font(20), fill="#BFC4CB")
    elif kind == "clock":
        originals.centered(draw, "10:24", (480, 361), 104, "#ECF2E8", True)
        originals.centered(draw, "TU TIEMPO. A TU MANERA.", (480, 461), 19, "#A3E635")
        draw.ellipse((820, 251, 832, 263), fill="#A3E635")
    elif kind == "weather":
        draw.rounded_rectangle((91, 246, 868, 542), radius=22, fill="#1F4658")
        draw.ellipse((717, 281, 798, 362), fill="#F7D46B")
        draw.text((132, 271), "Tu ciudad", font=originals.font(23, True), fill="white")
        draw.text((124, 320), "24°", font=originals.font(86), fill="white")
        draw.text((133, 443), "Condiciones y pronóstico", font=originals.font(22), fill="#D8EAF2")
        points = [(520+i*47, 477 - (math.sin(i*.7)*17)) for i in range(7)]
        draw.line(points, fill="#F7D46B", width=3)
        for x, y in points:
            draw.ellipse((x-4, y-4, x+4, y+4), fill="white")
    else:
        draw.rounded_rectangle((104, 251, 364, 534), radius=20, fill="#24382D")
        for i in range(17):
            height = 30 + abs(math.sin(i*.63)) * 130
            x = 133 + i * 12
            draw.rounded_rectangle((x, 397-height/2, x+6, 397+height/2), radius=3, fill="#4BDF8A")
        draw.text((418, 295), "Tu música, a la vista", font=originals.font(29, True), fill="white")
        draw.text((420, 359), "Página de Spotify para tu deck", font=originals.font(20), fill="#BFC4CB")
        draw.rounded_rectangle((421, 439, 815, 445), radius=3, fill="#3D4340")
        draw.rounded_rectangle((421, 439, 580, 445), radius=3, fill="#4BDF8A")
    originals.centered(draw, "VISTA PREVIA · DISEÑO ILUSTRATIVO", (480, 598), 13, "#78756E")
    image.save(OUT / "covers" / f"page-{kind}.png", optimize=True)


def main():
    for item in [
        ("football", "Fútbol", "Partidos, favoritos e historial. En tu deck."),
        ("clock", "Reloj", "Una página completa. Tu propio diseño."),
        ("weather", "Clima", "Tu ciudad, sus condiciones y lo que viene."),
        ("spotify", "Spotify", "La página de música de tu espacio."),
    ]:
        draw_cover(*item)
    manifest_path = OUT / "originals-manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["generators"] = ["scripts/generate-marketplace-assets.py", "scripts/generate-marketplace-page-covers.py"]
    files = sorted(p for p in OUT.rglob("*") if p.is_file() and p != manifest_path)
    manifest["files"] = [{"path": p.relative_to(OUT).as_posix(), "bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print("Created four native-page covers and refreshed the asset manifest.")


if __name__ == "__main__":
    main()
