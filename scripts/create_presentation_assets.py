from pathlib import Path
from urllib.request import Request, urlopen

import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "presentation_assets"
POKEMON = ROOT / "data" / "processed" / "pokemon_clean.csv"
EDGES = ROOT / "data" / "processed" / "team_edges_clean.csv"
IMAGE_LOOKUP = ROOT / "data" / "processed" / "image_lookup.csv"

W, H = 1400, 860
BG = "#11161d"
PANEL = "#18202a"
TEXT = "#fff7eb"
MUTED = "#b8c0c8"
ACCENT = "#f2b56b"
BLUE = "#4387c7"
RED = "#d85f3f"
GREEN = "#5c9f5b"
FAIRY = "#d282aa"


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


def canvas():
    return Image.new("RGB", (W, H), BG)


def rounded(draw, box, fill, outline=None, width=2, radius=28):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_centered(draw, xy, text, fnt, fill=TEXT):
    box = draw.textbbox((0, 0), text, font=fnt)
    draw.text((xy[0] - (box[2] - box[0]) / 2, xy[1] - (box[3] - box[1]) / 2), text, font=fnt, fill=fill)


def save(img, name):
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name, quality=95)


def load_sprite(url, size=154):
    try:
        request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(request, timeout=8) as response:
            sprite = Image.open(response).convert("RGBA")
        return sprite.resize((size, size), Image.Resampling.NEAREST)
    except Exception:
        return None


def pipeline():
    img = canvas()
    draw = ImageDraw.Draw(img)
    steps = [
        ("Raw Data", "stats"),
        ("Pokémon Nodes", ""),
        ("Team Edges", "teammates"),
        ("Build Data", "moves/items"),
        ("D3 Network", ""),
    ]
    x0, y, bw, bh, gap = 64, 325, 220, 170, 40
    for i, (title, subtitle) in enumerate(steps):
        x = x0 + i * (bw + gap)
        rounded(draw, (x, y, x + bw, y + bh), PANEL, "#2d3946", 3, 24)
        draw_centered(draw, (x + bw / 2, y + 72), title, font(25, True), TEXT)
        if subtitle:
            draw_centered(draw, (x + bw / 2, y + 116), subtitle, font(18), MUTED)
        if i < len(steps) - 1:
            ax = x + bw + 10
            ay = y + bh / 2
            draw.line((ax, ay, ax + gap - 20, ay), fill=ACCENT, width=5)
            draw.polygon([(ax + gap - 20, ay - 11), (ax + gap - 20, ay + 11), (ax + gap - 2, ay)], fill=ACCENT)
    save(img, "dataset_pipeline.png")


def correlation_insight():
    fig, ax = plt.subplots(figsize=(14, 8.6), dpi=100)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    labels = ["Stats → Usage", "Synergy → Usage"]
    values = [0.194, 0.929]
    bars = ax.barh(labels, values, color=[MUTED, ACCENT], height=0.5)
    ax.set_xlim(0, 1)
    for bar, value in zip(bars, values):
        ax.text(value + 0.035, bar.get_y() + bar.get_height() / 2, f"{value:.3f}", color=TEXT, fontsize=36, weight="bold", va="center")
    ax.tick_params(axis="x", colors=MUTED, labelsize=0, length=0)
    ax.tick_params(axis="y", colors=TEXT, labelsize=28)
    ax.grid(axis="x", color="#33404d", alpha=0.45)
    for spine in ax.spines.values():
        spine.set_visible(False)
    plt.tight_layout(pad=4)
    fig.savefig(OUT / "correlation_insight.png", facecolor=BG)
    plt.close(fig)


def case_study_cards():
    pokemon = pd.read_csv(POKEMON)
    images = pd.read_csv(IMAGE_LOOKUP).set_index("pokemon")["image_path_or_url"].to_dict()
    wanted = ["Zacian Crowned Sword", "Zamazenta Crowned Shield", "Incineroar", "Amoonguss"]
    rows = {row["Name"]: row for _, row in pokemon[pokemon["Name"].isin(wanted)].iterrows()}
    notes = {
        "Zacian Crowned Sword": "high stats",
        "Zamazenta Crowned Shield": "high stats, low usage",
        "Incineroar": "team synergy",
        "Amoonguss": "support utility",
    }
    colors = [FAIRY, BLUE, RED, GREEN]
    img = canvas()
    draw = ImageDraw.Draw(img)
    card_w, card_h, gap = 300, 600, 34
    start_x, y = 62, 130
    for i, name in enumerate(wanted):
        row = rows[name]
        x = start_x + i * (card_w + gap)
        rounded(draw, (x, y, x + card_w, y + card_h), PANEL, "#2d3946", 3, 26)
        draw.ellipse((x + 58, y + 44, x + 242, y + 228), fill=colors[i], outline="#fff7eb", width=4)
        sprite = load_sprite(images.get(name, ""))
        if sprite:
            img.paste(sprite, (x + 73, y + 58), sprite)
        else:
            draw_centered(draw, (x + 150, y + 136), name.split()[0], font(24, True), BG)
        draw_centered(draw, (x + 150, y + 304), name.replace(" Crowned Sword", "").replace(" Crowned Shield", ""), font(27, True), TEXT)
        draw_centered(draw, (x + 150, y + 378), notes[name], font(23, True), ACCENT)
        usage = float(row["Usage Percent (%)"]) if pd.notna(row["Usage Percent (%)"]) else 0
        draw_centered(draw, (x + 150, y + 482), f"{usage:.0f}% usage", font(24), MUTED)
    save(img, "case_study_cards.png")


def martini_glass():
    img = canvas()
    draw = ImageDraw.Draw(img)
    points = [
        ("Question", "stats?"),
        ("Contradiction", ""),
        ("Network", "synergy"),
        ("Exploration", "interaction"),
    ]
    coords = [(180, 330), (490, 330), (800, 440), (1110, 550)]
    for i in range(len(coords) - 1):
        draw.line((*coords[i], *coords[i + 1]), fill=ACCENT, width=8)
    for i, ((title, subtitle), (x, y)) in enumerate(zip(points, coords), start=1):
        draw.ellipse((x - 72, y - 72, x + 72, y + 72), fill=PANEL, outline=ACCENT, width=6)
        draw_centered(draw, (x, y - 8), str(i), font(38, True), ACCENT)
        draw_centered(draw, (x, y + 104), title, font(27, True), TEXT)
        if subtitle:
            draw_centered(draw, (x, y + 142), subtitle, font(19), MUTED)
    save(img, "martini_glass_flow.png")


def build_graph():
    pokemon = pd.read_csv(POKEMON)
    edges = pd.read_csv(EDGES)
    valid = pokemon[pokemon["missing_base_stats"].astype(str).str.lower() != "true"].copy()
    name_to_usage = valid.set_index("Name")["Usage Percent (%)"].fillna(0).to_dict()
    top_names = set(valid.sort_values("Usage Percent (%)", ascending=False).head(45)["Name"])
    top_names.update(["Incineroar", "Zacian Crowned Sword", "Kyogre", "Grimmsnarl", "Amoonguss"])
    sub_edges = edges[edges["source"].isin(top_names) & edges["target"].isin(top_names)].sort_values("co_usage_percent", ascending=False).head(95)
    graph = nx.Graph()
    for _, row in sub_edges.iterrows():
        graph.add_edge(row["source"], row["target"], weight=row["co_usage_percent"])
    graph.remove_nodes_from(list(nx.isolates(graph)))
    return graph, name_to_usage


def draw_network(path, labels=True, blur=False):
    graph, name_to_usage = build_graph()
    pos = nx.spring_layout(graph, seed=12, k=0.62, weight="weight", iterations=150)
    fig, ax = plt.subplots(figsize=(14, 8.6), dpi=100)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.axis("off")
    for u, v, _ in graph.edges(data=True):
        x1, y1 = pos[u]
        x2, y2 = pos[v]
        active = u == "Incineroar" or v == "Incineroar"
        ax.plot([x1, x2], [y1, y2], color=ACCENT if active else "#7e8994", alpha=0.8 if active else 0.16, linewidth=3.0 if active else 1.1)
    for name, (x, y) in pos.items():
        usage = float(name_to_usage.get(name, 0) or 0)
        size = 120 + usage * 28
        color = RED if name == "Incineroar" else "#78828d"
        edge = ACCENT if name == "Incineroar" else "#e8dfd0"
        ax.scatter(x, y, s=size, color=color, edgecolor=edge, linewidth=1.8, alpha=0.96 if name == "Incineroar" else 0.78)
    if labels:
        for name in ["Incineroar", "Zacian Crowned Sword", "Kyogre", "Grimmsnarl", "Amoonguss"]:
            if name in pos:
                x, y = pos[name]
                ax.text(x + 0.025, y + 0.025, name.replace(" Crowned Sword", ""), color=TEXT, fontsize=14, weight="bold")
    xs = [xy[0] for xy in pos.values()]
    ys = [xy[1] for xy in pos.values()]
    ax.set_xlim(min(xs) - 0.18, max(xs) + 0.18)
    ax.set_ylim(min(ys) - 0.18, max(ys) + 0.18)
    fig.tight_layout(pad=0)
    fig.savefig(path, facecolor=BG)
    plt.close(fig)
    if blur:
        img = Image.open(path).convert("RGB")
        img.filter(ImageFilter.GaussianBlur(7)).save(path, quality=95)


def network_mockup():
    draw_network(OUT / "network_mockup.png", labels=True, blur=False)
    draw_network(OUT / "network_blur.png", labels=False, blur=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pipeline()
    correlation_insight()
    case_study_cards()
    martini_glass()
    network_mockup()
    print(f"Created assets in {OUT}")


if __name__ == "__main__":
    main()
