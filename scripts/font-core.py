"""Refresh UI font subsets from the checked-in, licensed WOFF2 shards.

Run with Python + fonttools[woff]. No font download or build-time dependency.
"""
import re
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'src/assets/fonts'


def ranges(points):
    result = []
    for cp in sorted(points):
        if result and cp == result[-1][1] + 1:
            result[-1][1] = cp
        else:
            result.append([cp, cp])
    return ', '.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in result)


def face(family, weight, filename, points):
    return f'''@font-face {{
  font-family: "{family}";
  font-style: normal;
  font-weight: {weight};
  font-display: swap;
  src: url("./assets/fonts/{filename}") format("woff2");
  unicode-range: {ranges(points)};
}}
'''


def main():
    text = ''.join(p.read_text() for p in (ROOT / 'src').rglob('*')
                   if p.suffix in ('.tsx', '.ts') and '.test.' not in p.name)
    wanted = {ord(c) for c in text if 0x3000 <= ord(c) <= 0x9fff or 0xff00 <= ord(c) <= 0xffef}
    core_css, extended_css = [], []
    for prefix, family, weight in [
        ('source-han-sans-sc-400', 'Source Han Sans SC', 400),
        ('source-han-sans-sc-500', 'Source Han Sans SC', 500),
        ('source-han-serif-sc-700', 'Source Han Serif SC', 700),
    ]:
        paths = sorted(ASSETS.glob(prefix + '-*.woff2'))
        fonts = {p: TTFont(p) for p in paths}
        core_path = ASSETS / (prefix + '-core.woff2')
        original = fonts[core_path]
        sources = {cp: (f, glyph) for f in fonts.values() for cp, glyph in f.getBestCmap().items()}
        points = (wanted | set(original.getBestCmap())) & sources.keys()
        names = {cp: f'uni{cp:04X}' for cp in sorted(points)}
        charstrings, metrics = {}, {}
        for cp, name in [(None, '.notdef'), *names.items()]:
            f, glyph = (original, '.notdef') if cp is None else sources[cp]
            glyphs = f.getGlyphSet()
            width, lsb = f['hmtx'][glyph]
            pen = T2CharStringPen(width, glyphs)
            glyphs[glyph].draw(pen)
            charstrings[name] = pen.getCharString()
            metrics[name] = (width, lsb)
        fb = FontBuilder(original['head'].unitsPerEm, isTTF=False)
        fb.setupGlyphOrder(list(charstrings))
        fb.setupCharacterMap(names)
        fb.setupCFF(prefix, {'FullName': family, 'FamilyName': family, 'Weight': str(weight)}, charstrings, {})
        fb.setupHorizontalMetrics(metrics)
        fb.setupHorizontalHeader(ascent=original['hhea'].ascent, descent=original['hhea'].descent,
                                 lineGap=original['hhea'].lineGap)
        fb.setupNameTable({'familyName': family, 'styleName': str(weight), 'psName': prefix,
                          'copyright': original['name'].getDebugName(0) or '',
                          'licenseDescription': original['name'].getDebugName(13) or ''})
        os2 = original['OS/2']
        fb.setupOS2(usWeightClass=weight, sTypoAscender=os2.sTypoAscender,
                    sTypoDescender=os2.sTypoDescender, sTypoLineGap=os2.sTypoLineGap,
                    usWinAscent=os2.usWinAscent, usWinDescent=os2.usWinDescent,
                    sxHeight=os2.sxHeight, sCapHeight=os2.sCapHeight)
        fb.setupPost()
        fb.font['head'].created = original['head'].created
        fb.font['head'].modified = original['head'].modified
        fb.font.recalcTimestamp = False
        fb.font.flavor = 'woff2'
        fb.save(core_path)
        core_css.append(face(family, weight, core_path.name, points))
        for p, f in fonts.items():
            if p != core_path:
                extended_css.append(face(family, weight, p.name, set(f.getBestCmap()) - points))
        print(prefix, len(points), core_path.stat().st_size)
    # Keep authentic Latin weights and their existing coverage.
    existing = (ROOT / 'src/fonts.css').read_text()
    core_css += [block for block in re.findall(r'@font-face\s*\{[^}]+\}', existing)
                 if 'IBM Plex' in block]
    (ROOT / 'src/fonts.css').write_text('/* UI subsets; regenerate with scripts/font-core.py. */\n\n' + '\n'.join(core_css))
    (ROOT / 'src/fonts-extended.css').write_text('/* Other characters; loaded after the first content paint. */\n\n' + '\n'.join(extended_css))


if __name__ == '__main__':
    main()
