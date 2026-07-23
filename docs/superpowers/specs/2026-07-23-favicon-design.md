# LuCI Shadcn Favicon Design

## Objective

Replace the existing favicon family with one compact mark derived from the minimal zine poster. The mark must remain recognizable at 16 px, work on light and dark browser chrome, and retain a handmade editorial character without becoming visually busy.

## Approved Direction

Use the selected **rough-line router** direction.

The mark contains only two subjects:

1. An irregular warm paper fragment.
2. A restrained black router drawing.

The router is recognizable through three features: two slightly uneven antennas, a low horizontal chassis, and a row of signal lights. Its outline uses small intentional deviations in angle and alignment, but avoids the swollen organic silhouette rejected during exploration.

## Visual Rules

- Transparent canvas outside the paper fragment.
- Warm off-white paper fill with a simple irregular perimeter.
- Graphite-black router linework with rounded, subtly imperfect joins.
- No text, purple node, signal arcs, shadows, gradients, halftone pattern, photographic texture, border, or decorative marks.
- The paper silhouette carries the expressive irregularity; the router stays light, balanced, and legible.
- Preserve generous internal clearance so the router never touches the paper edge.

## Size Adaptation

- **512, 192, 180, and 96 px:** preserve the full irregular paper silhouette, two antennas, chassis outline, and four signal lights.
- **48 and 32 px:** simplify the paper perimeter and reduce the signal lights to three.
- **16 px:** use a near-square irregular paper silhouette, heavier router strokes, and two signal lights.
- All raster outputs use premultiplied-safe transparent edges with no matte fringe.

## Deliverables

Replace the existing files under `.dev/public/shadcn/images/`:

- `favicon.svg`
- `favicon.ico` containing 16, 32, and 48 px images
- `favicon-96x96.png`
- `apple-touch-icon.png` at 180 x 180
- `web-app-manifest-192x192.png`
- `web-app-manifest-512x512.png`

Keep the existing references in `header.ut` and `site.webmanifest` unchanged.

## Verification

- Confirm every PNG has an alpha channel and transparent corners.
- Confirm the ICO contains 16, 32, and 48 px entries.
- Inspect the 16 and 32 px variants against both light and dark tab backgrounds.
- Confirm the two antennas and at least two signal lights remain distinguishable at 16 px.
- Run the normal production asset build from `.dev/` after source assets are accepted.
