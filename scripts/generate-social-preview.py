from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path("/Users/birger/Community/open-medical-scribe")
OUT = ROOT / "public/brand/eir-scribe-social-preview.png"
ICON = ROOT / "public/brand/eir-icon-teal.png"
LOGO = ROOT / "public/brand/logo-colored.png"

W = 1200
H = 630

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def main() -> None:
    bg = Image.new("RGBA", (W, H), "#F5F4F0")

    for bbox, fill in [
        ((-120, -140, 620, 420), (212, 167, 106, 42)),
        ((640, -80, 1320, 520), (30, 148, 168, 34)),
        ((120, 360, 860, 860), (168, 197, 212, 32)),
    ]:
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        layer_draw = ImageDraw.Draw(layer)
        layer_draw.ellipse(bbox, fill=fill)
        bg.alpha_composite(layer.filter(ImageFilter.GaussianBlur(6)))

    card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(card)
    card_draw.rounded_rectangle(
        (54, 54, W - 54, H - 54),
        radius=42,
        fill=(250, 250, 247, 236),
        outline=(232, 230, 225, 255),
        width=2,
    )
    bg.alpha_composite(card)

    icon = Image.open(ICON).convert("RGBA").resize((92, 92))
    logo = Image.open(LOGO).convert("RGBA")
    logo.thumbnail((290, 110))
    bg.alpha_composite(icon, (88, 92))
    bg.alpha_composite(logo, (874, 84))

    draw = ImageDraw.Draw(bg)
    draw.text((88, 196), "Eir Scribe", font=load_font(FONT_BOLD, 28), fill="#1A6474")
    draw.text(
        (88, 234),
        "Recorder-first clinical documentation.",
        font=load_font(FONT_BLACK, 56),
        fill="#1A1917",
    )
    draw.multiline_text(
        (88, 320),
        "Open source medical scribe with a Sweden-hosted cloud app,\nclinician review, and editable documentation drafts.",
        font=load_font(FONT_REGULAR, 30),
        fill="#5A5650",
        spacing=12,
    )

    pills = [
        ("Stockholm", "#1E94A8"),
        ("Zero Eir retention", "#D4A76A"),
        ("/app ready", "#1A6474"),
    ]
    pill_y = 476
    x = 88
    for text, color in pills:
        pill_font = load_font(FONT_BOLD, 22)
        text_width = draw.textlength(text, font=pill_font)
        pill_width = int(text_width + 44)
        draw.rounded_rectangle((x, pill_y, x + pill_width, pill_y + 48), radius=24, fill=color)
        draw.text((x + 22, pill_y + 11), text, font=pill_font, fill="#FAFAF7")
        x += pill_width + 16

    panel = Image.new("RGBA", (390, 360), (255, 255, 255, 0))
    panel_draw = ImageDraw.Draw(panel)
    panel_draw.rounded_rectangle(
        (0, 0, 390, 360),
        radius=34,
        fill=(255, 255, 255, 245),
        outline=(232, 230, 225, 255),
        width=2,
    )
    panel_draw.rounded_rectangle((26, 24, 162, 58), radius=17, fill=(30, 148, 168, 20))
    panel_draw.text((46, 33), "Journal draft", font=load_font(FONT_BOLD, 18), fill="#1A6474")
    panel_draw.rounded_rectangle((178, 24, 360, 58), radius=17, fill=(212, 167, 106, 30))
    panel_draw.text((198, 33), "Clinician review", font=load_font(FONT_BOLD, 18), fill="#96703E")

    panel_draw.text((28, 96), "Kontaktorsak", font=load_font(FONT_BOLD, 20), fill="#1A1917")
    panel_draw.multiline_text(
        (28, 126),
        "Tre dagars halsont,\nfeberkänsla och trötthet.",
        font=load_font(FONT_REGULAR, 22),
        fill="#3D3A36",
        spacing=8,
    )
    panel_draw.text((28, 208), "För journalisering", font=load_font(FONT_BOLD, 20), fill="#1A1917")
    panel_draw.multiline_text(
        (28, 238),
        "Utkastet sammanfattar\nsamtalet och behöver\nverifieras av kliniker.",
        font=load_font(FONT_REGULAR, 22),
        fill="#3D3A36",
        spacing=8,
    )
    panel_draw.rounded_rectangle((28, 304, 360, 326), radius=11, fill=(212, 209, 203, 180))
    panel_draw.rounded_rectangle((28, 334, 306, 350), radius=8, fill=(232, 230, 225, 255))

    bg.alpha_composite(panel, (748, 188))
    bg.convert("RGB").save(OUT, quality=95)
    print(OUT)


if __name__ == "__main__":
    main()
