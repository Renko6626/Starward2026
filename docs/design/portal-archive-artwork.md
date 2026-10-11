# Portal archive artwork

The author workspace combines the publication typography of the NASA Graphics Standards Manual with selected diagrams from the Voyager Golden Record cover. Its pale peripheral grid, sparse diagonal hatching and gradient masks continue the existing site language.

## Golden Record source

- Credit: NASA/JPL.
- Context: https://science.nasa.gov/mission/voyager/golden-record-cover/
- Original image: https://science.nasa.gov/wp-content/uploads/2024/04/cover-diagram-large.jpg
- Local file: `public/images/portal/voyager-cover-explanation.jpg`.

The original image file is retained unchanged. CSS displays monochrome, clipped details of the record/stylus, pulsar diagram, image-reconstruction diagrams and hydrogen transition. The nearby English explanatory paragraphs are excluded by the clipping. The art is decorative, hidden from assistive technology and does not represent application data.

## Typography reference

https://www.nasa.gov/wp-content/uploads/2015/01/nasa_graphics_manual_nhb_1430-2_jan_1976.pdf

The relevant examples are PDF pages 35 (cover typography) and 43 (open publication grids). This is an adaptation to Starward's existing typefaces and dark palette, not a reproduction of NASA branding.

## Implementation

`ArchiveBackground.tsx` owns the decorative layers. `archive.css` controls their opacity, clipping and responsive placement. Static CSS masks and dark control surfaces preserve readability; the backgrounds require no animation, event listeners, or per-field measurements. Hatched cells use a fixed irregular arrangement so the pattern stays stable between renders.
