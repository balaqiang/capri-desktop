[Bahasa Indonesia](id/BLUEPRINT.md) · **English** · [← README](../README.md)

# Her body as a drawing

Draw her in Illustrator, name the layers, export one SVG, and she moves it herself: every part turns around its own pivot, and each
form (her whole body, her mask, a spark…) is a group she shows or hides.

## Layers to name

Every form is a top-level layer called `form-<name>`:

| Layer | Needed | What it is |
| --- | --- | --- |
| `form-full` | yes | her whole body |
| `form-mask` | yes | just her mask |
| `form-face`, `form-shards`, `form-spark`, `form-glitch`, `form-possess`, `form-silhouette` | no | her other shapes, drawn your way; without one she uses her effects |

Inside `form-full`, a group per part, named exactly:

`head` (needed), `jaw`, `hair_1` … `hair_5` (root to tip), `torso` (needed), `arm_L`, `forearm_L`, `hand_L`, `arm_R` (needed), `forearm_R`,
`hand_R`, `leg_L`, `leg_R` (needed). Put `forearm_L` inside `arm_L` and `hand_L` inside `forearm_L`, so they move together.

## Pivots

For each part, add a small circle named `pivot-<part>` where that joint is (`pivot-head` at the neck, `pivot-arm_L` at the shoulder). She
finds the joint there and hides the circle. Without one, the part turns around the corner of the drawing.

## Export

File › Export › Export As… › SVG, then in the options: Styling ***Presentation Attributes*** (she can't load a drawing's own CSS), Object IDs ***Layer Names***, Decimal 2, Minify off. Keep the
artboard about 240 × 420 with her feet at the bottom edge.

## Or export it for you

```bash
npm run export:ai -- path/to/capri.ai
```

Every layer, sub-layer and named group comes out as its own SVG in a folder next to the file, with `all.svg` (the whole drawing) and `manifest.json` (where each piece sits). It runs inside your Illustrator; your file isn't saved or changed.

## Check it

```bash
npm run check:blueprint -- path/to/capri.svg
```

It lists what's missing and names that look like typos. When it says **Ready**, put the file at `assets/capri/blueprint.svg`.

Scripts and event attributes are stripped when it loads: a drawing can't run anything.
