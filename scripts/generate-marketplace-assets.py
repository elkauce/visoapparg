#!/usr/bin/env python3
"""Generate VISO's original first-party media. Requires Pillow, NumPy and FFmpeg.

No downloaded graphics, recordings, fonts, marketplace packs or customer media are
included. DejaVu/Open Sans from the build machine are used only to rasterize text.
All animation periods close on a complete cycle for seamless playback.
"""

from __future__ import annotations

import json
import hashlib
import math
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "marketplace"
FONT_ROOT = Path("/usr/share/fonts/truetype/open-sans")
WARM = "#F5F3EF"
STATES = [
    ("libre", "Libre", (34, 213, 113), "check"),
    ("ocupado", "Ocupado", (246, 70, 83), "blocked"),
    ("reunion", "Reunión", (249, 188, 36), "people"),
    ("llamada", "Llamada", (153, 104, 255), "phone"),
    ("no-molestar", "No molestar", (240, 66, 164), "bell"),
    ("ausente", "Ausente", (140, 159, 184), "moon"),
]
UTILITIES = [
    ("musica", "Música", (75, 201, 245), "music"),
    ("clima", "Clima", (249, 188, 36), "sun"),
    ("deportes", "Deportes", (34, 213, 113), "ball"),
    ("camara", "Cámara", (96, 157, 255), "camera"),
    ("microfono", "Micrófono", (240, 66, 164), "mic"),
    ("pausa", "Pausa", (249, 144, 65), "pause"),
]


def font(size: int, bold: bool = False):
    path = FONT_ROOT / ("OpenSans-Bold.ttf" if bold else "OpenSans-Regular.ttf")
    if not path.exists():
        path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    return ImageFont.truetype(str(path), size)


def centered(draw, text, xy, size=20, fill="white", bold=False):
    draw.text(xy, text, font=font(size, bold), fill=fill, anchor="mm")


def icon(draw, kind, color, box=(60, 54, 196, 190), width=9):
    """Original geometric icons, expressed in a 100 × 100 coordinate system."""
    x0, y0, x1, y1 = box
    sx, sy = (x1 - x0) / 100, (y1 - y0) / 100

    def pt(p):
        return (x0 + p[0] * sx, y0 + p[1] * sy)

    def rect(b):
        return (*pt(b[:2]), *pt(b[2:]))

    def line(points, fill=color, w=width):
        draw.line([pt(p) for p in points], fill=fill, width=w, joint="curve")

    def ellipse(b, fill=None):
        draw.ellipse(rect(b), outline=color, width=width, fill=fill)

    if kind == "check":
        ellipse((10, 10, 90, 90))
        line([(29, 51), (43, 65), (73, 34)])
    elif kind == "blocked":
        ellipse((10, 10, 90, 90))
        line([(23, 23), (77, 77)])
    elif kind == "people":
        ellipse((36, 9, 64, 37))
        ellipse((6, 23, 27, 44))
        ellipse((73, 23, 94, 44))
        draw.arc(rect((25, 48, 75, 103)), 180, 360, fill=color, width=width)
        line([(25, 75), (25, 88)])
        line([(75, 75), (75, 88)])
        draw.arc(rect((-5, 54, 34, 93)), 180, 295, fill=color, width=width)
        draw.arc(rect((66, 54, 105, 93)), 245, 360, fill=color, width=width)
    elif kind == "phone":
        points = [(19, 12), (32, 10), (44, 32), (33, 44), (44, 60),
                  (59, 70), (72, 58), (93, 70), (89, 86), (78, 91),
                  (58, 85), (35, 69), (18, 46), (11, 25), (19, 12)]
        line(points)
    elif kind == "bell":
        draw.arc(rect((23, 13, 77, 76)), 180, 360, fill=color, width=width)
        line([(23, 44), (23, 61), (14, 73), (85, 73), (77, 61), (77, 44)])
        draw.arc(rect((39, 76, 61, 94)), 0, 180, fill=color, width=width)
        line([(8, 6), (92, 92)])
    elif kind == "moon":
        # Two equal-radius intersecting arcs form a continuous crescent outline.
        # No solid fill or straight closing line obscures the curved inner edge.
        r, dx, dy = 40, 18, -10
        distance = math.hypot(dx, dy)
        middle_x, middle_y = 50 + dx / 2, 50 + dy / 2
        height = math.sqrt(r * r - distance * distance / 4)
        lower = (middle_x - dy / distance * height,
                 middle_y + dx / distance * height)
        upper = (middle_x + dy / distance * height,
                 middle_y - dx / distance * height)
        outer_start = math.atan2(lower[1] - 50, lower[0] - 50)
        outer_end = math.atan2(upper[1] - 50, upper[0] - 50) + 2 * math.pi
        points = [(50 + r * math.cos(a), 50 + r * math.sin(a))
                  for a in np.linspace(outer_start, outer_end, 80)]
        inner_start = math.atan2(upper[1] - (50 + dy), upper[0] - (50 + dx)) + 2 * math.pi
        inner_end = math.atan2(lower[1] - (50 + dy), lower[0] - (50 + dx))
        points += [(50 + dx + r * math.cos(a), 50 + dy + r * math.sin(a))
                   for a in np.linspace(inner_start, inner_end, 60)]
        line(points + [points[0]])
    elif kind == "music":
        line([(38, 72), (38, 20), (79, 10), (79, 62)])
        ellipse((14, 62, 39, 82), color)
        ellipse((55, 52, 80, 72), color)
    elif kind == "sun":
        ellipse((28, 28, 72, 72))
        for angle in range(0, 360, 45):
            a = math.radians(angle)
            line([(50 + 33 * math.cos(a), 50 + 33 * math.sin(a)),
                  (50 + 44 * math.cos(a), 50 + 44 * math.sin(a))])
    elif kind == "ball":
        ellipse((8, 8, 92, 92))
        vertices = [(50 + 18 * math.sin(a * math.pi / 2.5),
                     50 - 18 * math.cos(a * math.pi / 2.5)) for a in range(5)]
        line(vertices + [vertices[0]])
        for v in vertices:
            dx, dy = v[0] - 50, v[1] - 50
            line([v, (50 + dx * 2.1, 50 + dy * 2.1)])
    elif kind == "camera":
        draw.rounded_rectangle(rect((10, 25, 90, 82)), radius=9,
                               outline=color, width=width)
        line([(30, 25), (36, 13), (64, 13), (71, 25)])
        ellipse((35, 37, 65, 67))
    elif kind == "mic":
        draw.rounded_rectangle(rect((37, 6, 63, 63)), radius=15,
                               outline=color, width=width)
        draw.arc(rect((24, 32, 76, 82)), 0, 180, fill=color, width=width)
        line([(50, 80), (50, 95)])
        line([(36, 95), (64, 95)])
    elif kind == "pause":
        draw.rounded_rectangle(rect((25, 15, 40, 85)), radius=4, fill=color)
        draw.rounded_rectangle(rect((60, 15, 75, 85)), radius=4, fill=color)


def key_frame(entry, phase=0.0, size=256):
    _, name, color, kind = entry
    yy, xx = np.mgrid[0:size, 0:size]
    pulse = (math.sin(phase) + 1) / 2
    light = np.exp(-(((xx - size * .5) / (size * .47)) ** 2
                      + ((yy - size * .66) / (size * .43)) ** 2) * 2.5)
    glow = light * (.11 + .25 * pulse)
    rgb = np.array([12, 15, 20]) + glow[..., None] * np.array(color)
    image = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert("RGB")
    mask = Image.new("L", (size, size))
    ImageDraw.Draw(mask).rounded_rectangle((3, 3, size - 4, size - 4), radius=30, fill=255)
    canvas = Image.new("RGB", (size, size), (6, 8, 11))
    canvas.paste(image, (0, 0), mask)
    # Rasterize the geometry and type at 3×, then downsample once. Curves and
    # diagonals stay clean when a Stream Deck-sized key is shown at small sizes.
    scale = 3
    overlay = Image.new("RGBA", (size * scale, size * scale))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((12, 12, 753, 753), radius=90, outline=(53, 58, 64), width=6)
    draw.rounded_rectangle((30, 30, 735, 720), radius=75, outline=(25, 29, 35), width=9)
    soft = tuple(int(c * (.8 + .2 * pulse)) for c in color)
    icon(draw, kind, soft, (189, 141, 579, 531), width=24)
    centered(draw, name, (384, 621), 60 if len(name) < 10 else 54, bold=True)
    draw.rounded_rectangle((129, 720, 639, 738), radius=9, fill=soft)
    draw.ellipse((681, 54, 702, 75), fill=tuple(int(c * .9) for c in color))
    overlay = overlay.resize((size, size), Image.Resampling.LANCZOS)
    canvas.paste(overlay, (0, 0), overlay)
    return canvas


def cover_base(eyebrow, title, subtitle):
    image = Image.new("RGB", (960, 640), WARM)
    draw = ImageDraw.Draw(image)
    # The restrained dotted background matches the VISO web surface.
    for x in range(24, 960, 24):
        for y in range(24, 640, 24):
            draw.ellipse((x, y, x + 1, y + 1), fill="#DEDAD3")
    draw.rounded_rectangle((42, 32, 108, 58), 13, fill="#E84B0A")
    centered(draw, "VISO", (75, 45), 12, bold=True)
    draw.text((123, 34), eyebrow.upper(), font=font(15), fill="#6B6863")
    draw.text((42, 91), title, font=font(42, True), fill="#151719")
    draw.text((44, 154), subtitle, font=font(18), fill="#6B6863")
    return image


def key_grid_cover(title, subtitle, entries, filename, eyebrow="Originales"):
    image = cover_base(eyebrow, title, subtitle)
    for i, entry in enumerate(entries[:6]):
        # Only derived original art is resized here; no customer media is edited.
        face = key_frame(entry, math.pi / 2).resize((174, 174), Image.Resampling.LANCZOS)
        image.paste(face, (182 + (i % 3) * 205, 218 + (i // 3) * 190))
    image.save(OUT / "covers" / filename, optimize=True)


def encode_frames(frames, path, fps=12):
    width, height = frames[0].size
    command = ["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pixel_format", "rgb24",
               "-video_size", f"{width}x{height}", "-framerate", str(fps), "-i", "-", "-an",
               "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-pix_fmt", "yuv420p",
               "-movflags", "+faststart", str(path)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    for frame in frames:
        process.stdin.write(frame.convert("RGB").tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError(f"FFmpeg failed for {path.name}")


def aurora_frame(phase, width=768, height=432):
    yy, xx = np.mgrid[0:height, 0:width]
    x, y = xx / width, yy / height
    glow = np.zeros((height, width, 3)) + np.array([7, 13, 21])
    sources = [(.29 + .09 * math.cos(phase), .55 + .08 * math.sin(phase), (35, 194, 115)),
               (.66 + .08 * math.sin(phase), .38 + .10 * math.cos(phase), (115, 67, 219)),
               (.54 + .08 * math.cos(phase + 2), .75 + .05 * math.sin(phase), (24, 133, 178))]
    for cx, cy, color in sources:
        layer = np.exp(-(((x - cx) / .36) ** 2 + ((y - cy) / .50) ** 2) * 2)
        glow += layer[..., None] * np.array(color) * .63
    # A moving light ribbon is visible even on small screens.
    ribbon_y = .50 + .13 * np.sin(x * 5 + math.sin(phase) * .8)
    ribbon = np.exp(-((y - ribbon_y) / .07) ** 2) * .12
    glow += ribbon[..., None] * np.array([75, 175, 150])
    return Image.fromarray(np.clip(glow, 0, 255).astype(np.uint8))


def make_sound(filename, notes, duration=.8):
    sample_rate = 22050
    samples = np.arange(int(sample_rate * duration)) / sample_rate
    signal = np.zeros(len(samples))
    for offset, frequency in notes:
        t = samples - offset
        gate = t >= 0
        signal += (np.sin(2 * math.pi * frequency * t)
                   + .18 * np.sin(2 * math.pi * frequency * 2 * t)) * np.exp(-np.maximum(t, 0) * 8) * gate
    fade_in = np.minimum(samples / .012, 1)
    fade_out = np.minimum((duration - samples) / .10, 1)
    signal *= fade_in * fade_out
    peak = max(float(np.max(np.abs(signal))), 1)
    pcm = (signal / peak * .4 * 32767).astype("<i2")
    with wave.open(str(OUT / "sounds" / filename), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(sample_rate)
        audio.writeframes(pcm.tobytes())


def main():
    if shutil.which("ffmpeg") is None:
        raise SystemExit("FFmpeg must be installed before generating video assets.")
    for directory in ["originals", "animated", "covers", "screensavers", "sounds"]:
        (OUT / directory).mkdir(parents=True, exist_ok=True)

    for entry in STATES + UTILITIES:
        key_frame(entry, math.pi / 2).save(OUT / "originals" / f"{entry[0]}.png", optimize=True)
    for entry in STATES:
        frames = [key_frame(entry, 2 * math.pi * i / 24) for i in range(24)]
        encode_frames(frames, OUT / "animated" / f"{entry[0]}.mp4", fps=8)
        gif_frames = [frame.resize((192, 192), Image.Resampling.LANCZOS).quantize(colors=48)
                      for frame in frames[::2]]
        gif_frames[0].save(OUT / "animated" / f"{entry[0]}.gif", save_all=True,
                           append_images=gif_frames[1:], duration=250, loop=0,
                           optimize=True, disposal=2)

    key_grid_cover("Iconos con identidad propia", "12 diseños originales · PNG · Gratis", STATES,
                   "original-icons.png")
    key_grid_cover("Tus estados cobran vida", "6 diseños animados · GIF y MP4 · Gratis", STATES,
                   "living-icons.png", "Pulso")
    key_grid_cover("Todo empieza con un toque", "Una página nueva · Seis estados · Tus páginas se conservan", STATES,
                   "essential-profile.png", "Deck Esencial")
    key_grid_cover("VISO en tus teclas", "Tu plugin personalizado desde Conexiones", STATES,
                   "stream-deck.png", "Stream Deck")

    ambient = [aurora_frame(2 * math.pi * i / 72) for i in range(72)]
    encode_frames(ambient, OUT / "screensavers" / "aurora.mp4", fps=12)
    cover = cover_base("Aurora", "Un espacio para desconectar", "Video ambiental · Movimiento suave · Sin sonido")
    preview = ambient[18].resize((824, 348), Image.Resampling.LANCZOS)
    mask = Image.new("L", preview.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 823, 347), 28, fill=255)
    cover.paste(preview, (68, 229), mask)
    cover.save(OUT / "covers" / "ambient-screen.png", optimize=True)

    make_sound("confirmar.wav", [(0, 523.25), (.12, 783.99)], .75)
    make_sound("atencion.wav", [(0, 659.25), (.16, 659.25)], .75)
    make_sound("pausa.wav", [(0, 523.25), (.14, 392.00)], .9)
    cover = cover_base("Señales suaves", "Pequeños sonidos, claras señales", "3 sonidos originales · WAV · Gratis")
    draw = ImageDraw.Draw(cover)
    draw.rounded_rectangle((68, 236, 892, 562), radius=28, fill="#15191E")
    colors = [(34, 213, 113), (249, 188, 36), (153, 104, 255)]
    for i, (label, color) in enumerate(zip(["Confirmar", "Atención", "Pausa"], colors)):
        cx = 222 + i * 258
        for bar in range(17):
            h = 15 + abs(math.sin(bar * .63 + i * .7)) * 72
            x = cx - 80 + bar * 10
            draw.rounded_rectangle((x, 371 - h / 2, x + 5, 371 + h / 2), 2, fill=color)
        centered(draw, label, (cx, 471), 20, bold=True)
    cover.save(OUT / "covers" / "soft-sounds.png", optimize=True)

    # This is reproducible provenance, not a purchase receipt or seller claim.
    media_files = sorted(path for path in OUT.rglob("*")
                         if path.is_file() and path.name != "originals-manifest.json")
    manifest = {
        "creator": "VISO",
        "generator": "scripts/generate-marketplace-assets.py",
        "rights": "Original VISO graphics, animation and synthesized sounds.",
        "video": {"codec": "H.264", "pixelFormat": "yuv420p", "audio": False},
        "files": [
            {
                "path": str(path.relative_to(OUT)),
                "bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
            for path in media_files
        ],
    }
    (OUT / "originals-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    files = [path for path in OUT.rglob("*") if path.is_file()]
    print(f"Generated {len(files)} files, {sum(path.stat().st_size for path in files):,} bytes")


if __name__ == "__main__":
    main()
