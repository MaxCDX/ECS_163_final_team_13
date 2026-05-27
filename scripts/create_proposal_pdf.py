from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "proposal" / "teamXXproposal.pdf"
ASSETS = ROOT / "data" / "presentation_assets"

DPI = 170
PAGE_W = int(8.5 * DPI)
PAGE_H = int(11 * DPI)
MARGIN = DPI
TEXT_W = PAGE_W - MARGIN * 2

BLACK = "#111111"
MUTED = "#444444"
RULE = "#b8b8b8"
ACCENT = "#d85f3f"
WHITE = "#ffffff"


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Helvetica.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


F = {
    "title": font(44, True),
    "meta": font(20),
    "h2": font(27, True),
    "h3": font(23, True),
    "body": font(22),
    "body_bold": font(22, True),
    "small": font(18),
    "caption": font(17),
    "ref": font(19),
}


def page():
    return Image.new("RGB", (PAGE_W, PAGE_H), WHITE)


def draw_rule(draw, y):
    draw.line((MARGIN, y, PAGE_W - MARGIN, y), fill=RULE, width=2)


def line_height(fnt, extra=6):
    box = fnt.getbbox("Ag")
    return box[3] - box[1] + extra


def text_width(draw, text, fnt):
    return draw.textlength(text, font=fnt)


def wrap(draw, text, fnt, max_width):
    words = text.split()
    lines = []
    line = ""
    for word in words:
        candidate = word if not line else f"{line} {word}"
        if text_width(draw, candidate, fnt) <= max_width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def paragraph(draw, xy, text, max_width=TEXT_W, fnt=None, fill=BLACK, spacing=6):
    if fnt is None:
        fnt = F["body"]
    x, y = xy
    for line in wrap(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += line_height(fnt, spacing)
    return y + 8


def heading(draw, y, text):
    y += 18
    draw.text((MARGIN, y), text, font=F["h2"], fill=BLACK)
    y += line_height(F["h2"], 3)
    draw_rule(draw, y)
    return y + 12


def subheading(draw, y, text, x=MARGIN):
    y += 10
    draw.text((x, y), text, font=F["h3"], fill=BLACK)
    return y + line_height(F["h3"], 4)


def bullet_list(draw, x, y, items, max_width, fnt=None):
    if fnt is None:
        fnt = F["body"]
    indent = 24
    for item in items:
        draw.text((x, y), "-", font=fnt, fill=BLACK)
        lines = wrap(draw, item, fnt, max_width - indent)
        for i, line in enumerate(lines):
            draw.text((x + indent, y), line, font=fnt, fill=BLACK)
            y += line_height(fnt, 5)
        y += 4
    return y + 4


def numbered_list(draw, x, y, items, max_width):
    indent = 36
    for i, item in enumerate(items, start=1):
        number = f"{i}."
        draw.text((x, y), number, font=F["body_bold"], fill=BLACK)
        lines = wrap(draw, item, F["body"], max_width - indent)
        for line in lines:
            draw.text((x + indent, y), line, font=F["body"], fill=BLACK)
            y += line_height(F["body"], 5)
        y += 4
    return y + 4


def place_image(draw, page_img, path, box, caption):
    x, y, w, h = box
    img = Image.open(path).convert("RGB")
    img.thumbnail((w, h), Image.Resampling.LANCZOS)
    px = x + (w - img.width) // 2
    page_img.paste(img, (px, y))
    draw.rectangle((px, y, px + img.width, y + img.height), outline="#cccccc", width=2)
    return paragraph(draw, (x, y + img.height + 10), caption, w, F["caption"], MUTED, 4)


def page_one():
    img = page()
    draw = ImageDraw.Draw(img)
    y = MARGIN - 18
    draw.text((MARGIN, y), "What Really Makes a Pokemon Strong?", font=F["title"], fill=BLACK)
    y += line_height(F["title"], 2)
    draw.text((MARGIN, y), "ECS 163 Final Project Proposal | Team XX | React + D3 narrative visualization", font=F["meta"], fill=MUTED)
    y += 30

    y = heading(draw, y, "Introduction: What We Seek to Convey")
    y = paragraph(
        draw,
        (MARGIN, y),
        "Our project explains a familiar but misleading assumption for novice audiences: in competitive Pokemon, higher base stats do not automatically mean a Pokemon is more successful. We will show that competitive strength is relational. A Pokemon becomes valuable not only because of its own stats, but because of how it fits into teams through common partners, moves, items, abilities, and strategic roles.",
    )
    y = paragraph(
        draw,
        (MARGIN, y),
        "We use two related Kaggle datasets. The first contains base stats, VGC 2022 legality, monthly usage, teammate co-usage, moves, items, and abilities. The second provides image references used as supporting visual assets. After preprocessing, our prototype uses 1,098 Pokemon/form rows, 2,606 teammate edges, and 2,967 build-usage rows.",
    )
    y = paragraph(
        draw,
        (MARGIN, y),
        "Early analysis found that total base stats and usage have a weak correlation, about 0.194, while weighted team connectivity and usage are much more strongly related, about 0.929. This gives the story a clear finding: raw strength explains part of competitive success, but team synergy explains why some moderate-stat support Pokemon become central.",
    )

    col_w = (TEXT_W - 36) // 2
    left_x = MARGIN
    right_x = MARGIN + col_w + 36
    col_y = y + 8
    y_left = subheading(draw, col_y, "Findings We Will Share", left_x)
    bullet_list(
        draw,
        left_x,
        y_left,
        [
            "Zacian Crowned Sword has very high stats and very high usage, matching beginner expectations.",
            "Zamazenta Crowned Shield and Mewtwo show that high stats can still produce low usage.",
            "Incineroar has 530 total base stats, but 59% usage, rank 2 usage, 199 teammate connections, and the highest weighted synergy signal.",
            "Amoonguss and Grimmsnarl reveal support value: their usefulness appears through team context.",
        ],
        col_w,
        F["small"],
    )
    place_image(
        draw,
        img,
        ASSETS / "correlation_insight.png",
        (right_x, col_y + 16, col_w, 330),
        "Figure 1. Weighted team connectivity is far more aligned with usage than raw total stats.",
    )

    y = heading(draw, 1312, "Advanced Visualization Idea")
    y = paragraph(
        draw,
        (MARGIN, y),
        "The main visual representation will be a programmatically generated force-directed team-synergy network built with D3. Each node represents a Pokemon. Node size encodes usage percentage, node color encodes primary type, edge thickness encodes teammate co-usage strength, and edge opacity de-emphasizes weaker relationships. Clicking a node locks attention on that Pokemon and updates a side panel with usage, rank, common moves, common item, common ability, and top teammates.",
    )
    paragraph(
        draw,
        (MARGIN, y),
        "The new component is the role-centered interaction: users move from an individual Pokemon to the local team ecosystem around it. This translates the abstract idea of synergy into visible structure: central nodes, thick links, and partner clusters.",
    )
    return img


def page_two():
    img = page()
    draw = ImageDraw.Draw(img)
    y = MARGIN - 12
    y = place_image(
        draw,
        img,
        ASSETS / "network_mockup.png",
        (MARGIN, y, TEXT_W, 520),
        "Figure 2. Main visualization sketch/prototype: a D3 force-directed network where Pokemon strength is interpreted through usage and teammate relationships, not only stats.",
    )

    y = heading(draw, y + 2, "Storytelling Structure and Storyboard")
    y = paragraph(
        draw,
        (MARGIN, y),
        "We chose a Martini Glass structure because the audience needs guidance before open exploration. The first part is author-driven: we introduce the raw-stat assumption, reveal contradictions, and explain the network encodings. The final part opens into user-driven exploration, where users can click Pokemon and test whether the synergy argument holds across other examples.",
    )
    y = numbered_list(
        draw,
        MARGIN,
        y + 2,
        [
            "Hook: ask what really makes a Pokemon strong and introduce the assumption that total base stats should predict usage.",
            "Contradiction: use an annotated comparison chart for Zacian, Zamazenta, and Incineroar; animation moves attention from high stats to unexpected usage.",
            "Introduce the metaphor: show the team ecosystem network and explain that nodes are Pokemon and links are teammate relationships.",
            "Case study: focus on Incineroar, highlighting thick links while the detail panel shows teammates, builds, stats, and role.",
            "Open exploration: let users click other Pokemon and compare central support Pokemon with isolated high-stat Pokemon.",
        ],
        TEXT_W,
    )

    col_w = (TEXT_W - 36) // 2
    left_x = MARGIN
    right_x = MARGIN + col_w + 36
    y_cols = y + 6
    y_left = subheading(draw, y_cols, "Attention and Transitions", left_x)
    y_left = paragraph(
        draw,
        (left_x, y_left),
        "We will guide attention through staged annotations, selective highlighting, muted inactive edges, and smooth transitions between the comparison view and the network view. Each new visual encoding will be introduced before the user needs it.",
        col_w,
        F["small"],
        BLACK,
        4,
    )
    draw.line((left_x, y_left + 8, left_x, y_left + 116), fill=ACCENT, width=5)
    paragraph(
        draw,
        (left_x + 18, y_left + 8),
        "Current prototype: CSV loading, D3 force layout, hover tooltips, click selection, reset behavior, teammate highlighting, and a detail panel. Next steps: guided annotations, transition timing, cluster labels, limitations note, and final visual polish.",
        col_w - 22,
        F["small"],
        BLACK,
        4,
    )
    place_image(
        draw,
        img,
        ASSETS / "martini_glass_flow.png",
        (right_x, y_cols + 8, col_w, 330),
        "Figure 3. Story flow: guided explanation first, then open interaction.",
    )
    return img


def references_page():
    img = page()
    draw = ImageDraw.Draw(img)
    y = MARGIN - 12
    y = heading(draw, y, "References")
    refs = [
        "Segel, E., & Heer, J. (2010). Narrative visualization: Telling stories with data. IEEE Transactions on Visualization and Computer Graphics, 16(6), 1139-1148.",
        "Carbone, G. Complete Competitive Pokemon Database (May 2022). Kaggle. https://www.kaggle.com/datasets/giorgiocarbone/complete-competitive-pokmon-datasets-may-2022",
        "Divyanshu Singh. Dataset of 32000 Pokemon Images & CSV, JSON. Kaggle. https://www.kaggle.com/datasets/divyanshusingh369/complete-pokemon-library-32k-images-and-csv",
        "D3.js: Data-Driven Documents. https://d3js.org/",
        "React. https://react.dev/",
    ]
    for ref in refs:
        y = paragraph(draw, (MARGIN, y), ref, TEXT_W, F["ref"], BLACK, 5)
    return img


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pages = [page_one(), page_two(), references_page()]
    pages[0].save(OUT, "PDF", resolution=DPI, save_all=True, append_images=pages[1:])
    print(f"Saved {OUT}")


if __name__ == "__main__":
    main()
