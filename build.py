#!/usr/bin/env python3
"""Tiny static-site builder for Halcyon Studio.

Edit pages in src/pages/ and shared blocks in src/partials/, then run:

    python3 build.py

The finished HTML is written to the repository root (index.html, work.html, ...),
which is what gets deployed. No dependencies beyond the Python standard library.

Template syntax
---------------
<!-- meta: key=value | key=value -->   first line of a page: title, description, page
{{> partial}}                          include src/partials/partial.html
{{title}} {{description}} {{page}}     page variables
{{nav:work}}                           ' aria-current="page"' when page == work
{{img name|alt|sizes|eager}}           responsive <img> for assets/img/name(-sm).webp
{{icon name}}                          inline SVG icon
"""
from __future__ import annotations

import html
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
IMG = ROOT / "assets" / "img"

ICONS = {
    "arrow": '<svg class="arrow" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M1 7h12M8 2l5 5-5 5"/></svg>',
    "arrow-left": '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M13 7H1M6 2L1 7l5 5"/></svg>',
    "arrow-ur": '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 12L12 2M4 2h8v8"/></svg>',
    "check": '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg>',
    "star": '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 .8l2.2 4.6 5 .7-3.6 3.5.9 5L8 12.2 3.5 14.6l.9-5L.8 6.1l5-.7z"/></svg>',
    "spark": '<svg class="star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0z"/></svg>',
    "ring": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="14" r="7"/><path d="M9 3h6l-3 4z"/></svg>',
    "user": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    "brief": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/></svg>',
    "glass": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M7 3h10l-1 7a4 4 0 01-8 0zM12 14v7M8 21h8"/></svg>',
    "aperture": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3l3.5 8M21 12l-8.5 1M16.5 19.8L11 13M3 12l8.5-1M7.5 4.2L13 11M12 21l-3.5-8"/></svg>',
    "mountain": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 20l7-12 4 6 3-4 6 10z"/></svg>',
    "camera": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="4"/></svg>',
    "images": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/></svg>',
    "clock": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    "film": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/></svg>',
    "book": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 4h7a2 2 0 012 2v14a2 2 0 00-2-2H4zM20 4h-5a2 2 0 00-2 2v14a2 2 0 012-2h5z"/></svg>',
    "shield": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    "pin": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    "lock": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
    "plane": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 13l20-8-6 16-4-6z"/><path d="M12 15l10-10"/></svg>',
    "close": '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>',
}

_dims_cache: dict[str, tuple[int, int]] = {}


def webp_size(path: Path) -> tuple[int, int]:
    """Read width/height from a WebP header (VP8, VP8L, VP8X)."""
    if path in _dims_cache:
        return _dims_cache[path]
    data = path.read_bytes()[:40]
    chunk = data[12:16]
    if chunk == b"VP8 ":
        w, h = struct.unpack("<HH", data[26:30])
        size = (w & 0x3FFF, h & 0x3FFF)
    elif chunk == b"VP8L":
        b = data[21:25]
        bits = int.from_bytes(b, "little")
        size = ((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)
    elif chunk == b"VP8X":
        w = int.from_bytes(data[24:27], "little") + 1
        h = int.from_bytes(data[27:30], "little") + 1
        size = (w, h)
    else:
        raise ValueError(f"Unrecognised WebP: {path}")
    _dims_cache[path] = size
    return size


def render_img(arg: str) -> str:
    parts = [p.strip() for p in arg.split("|")]
    name = parts[0]
    alt = parts[1] if len(parts) > 1 else ""
    sizes = parts[2] if len(parts) > 2 and parts[2] else "(max-width: 900px) 100vw, 50vw"
    eager = len(parts) > 3 and parts[3] == "eager"
    small = IMG / f"{name}-sm.webp"
    large = IMG / f"{name}.webp"
    if not small.exists() or not large.exists():
        raise FileNotFoundError(f"Missing image: {name}")
    w, h = webp_size(small)
    lw, _ = webp_size(large)
    attrs = [
        f'src="assets/img/{name}-sm.webp"',
        f'srcset="assets/img/{name}-sm.webp {w}w, assets/img/{name}.webp {lw}w"',
        f'sizes="{sizes}"',
        f'width="{w}" height="{h}"',
        f'alt="{html.escape(alt, quote=True)}"',
        'loading="eager" fetchpriority="high"' if eager else 'loading="lazy"',
        'decoding="async"',
    ]
    return "<img " + " ".join(attrs) + ">"


def parse_meta(text: str) -> tuple[dict[str, str], str]:
    m = re.match(r"\s*<!--\s*meta:(.*?)-->\s*", text, re.S)
    meta: dict[str, str] = {}
    if m:
        for pair in m.group(1).split("|"):
            if "=" in pair:
                k, v = pair.split("=", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    return meta, text


def render(text: str, meta: dict[str, str], depth: int = 0) -> str:
    if depth > 5:
        raise RecursionError("Partials nested too deeply")

    def partial(m: re.Match) -> str:
        p = SRC / "partials" / f"{m.group(1)}.html"
        return render(p.read_text(encoding="utf-8"), meta, depth + 1)

    text = re.sub(r"\{\{>\s*([\w-]+)\s*\}\}", partial, text)
    text = re.sub(r"\{\{img\s+(.+?)\}\}", lambda m: render_img(m.group(1)), text)
    text = re.sub(r"\{\{icon\s+([\w-]+)\}\}", lambda m: ICONS[m.group(1)], text)
    text = re.sub(
        r"\{\{nav:([\w-]+)\}\}",
        lambda m: ' aria-current="page"' if meta.get("page") == m.group(1) else "",
        text,
    )
    text = re.sub(r"\{\{(title|description|page)\}\}", lambda m: html.escape(meta.get(m.group(1), ""), quote=True), text)
    return text


def main() -> None:
    pages = sorted((SRC / "pages").glob("*.html"))
    for page in pages:
        meta, body = parse_meta(page.read_text(encoding="utf-8"))
        out = render(body, meta)
        leftover = re.findall(r"\{\{.*?\}\}", out)
        if leftover:
            raise SystemExit(f"{page.name}: unresolved tags {leftover[:3]}")
        (ROOT / page.name).write_text(out, encoding="utf-8")
        print(f"built {page.name}")


if __name__ == "__main__":
    main()
