"""Create browser-sized WebP copies of the supplied manufacturer photographs.

Run from any directory with Python 3 + Pillow. Originals remain unchanged.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "public" / "products"
SOURCES = {
    "khb-air": "KHB-AIR/KHB 1 (1).png",
    "khb-air-folded": "KHB-AIR/KHB 1 (3).png",
    "wv2": "WV2/擦窗机专业摄影_正背面视角2.jpg",
    "sc4d": "SC4D/1513280_std_01_96 dpi (jpg).jpg",
    "puzzi-8-1": "PUZZI-8-1/1100240_hero_01.tif",
}


def prepare(name: str, relative: str) -> None:
    with Image.open(ROOT / "images" / relative) as source:
        image = ImageOps.exif_transpose(source).convert("RGBA")
        if image.getextrema()[3][0] < 255:
            bounds = image.getchannel("A").getbbox()
        else:
            # Remove only empty photographic margins; retain the supplied background.
            background = Image.new("RGB", image.size, image.getpixel((0, 0))[:3])
            difference = ImageChops.difference(image.convert("RGB"), background)
            bounds = difference.convert("L").point(lambda value: 255 if value > 22 else 0).getbbox()
        if bounds:
            padding = round(max(image.size) * 0.018)
            left, top, right, bottom = bounds
            image = image.crop((max(0, left - padding), max(0, top - padding),
                                min(image.width, right + padding), min(image.height, bottom + padding)))
        image.thumbnail((768, 640), Image.Resampling.LANCZOS)
        target = DESTINATION / f"{name}.webp"
        image.save(target, "WEBP", quality=86, method=6)
        print(f"{target.relative_to(ROOT)}: {image.width}x{image.height}, {target.stat().st_size:,} bytes")


if __name__ == "__main__":
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for name, relative in SOURCES.items():
        prepare(name, relative)
