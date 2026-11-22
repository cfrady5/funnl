# Brand Guidelines

Source of truth for tokens: `packages/core/src/brand.ts`. The videos, covers and dashboard all read from it.

## Tiresias — SEE WHAT THE BOX SCORE CAN'T.
- **Voice:** intelligent, premium, analytical, confident, basketball-first. Short declarative sentences. No hype words.
- **Visuals:**
  - Near-black `#05070A`, ivory ink `#F3F1EC`, signal mint `#5BE7C4`.
  - Inter Tight 800 for display, JetBrains Mono for data and eyebrows.
  - Hairlines, not boxes.
- **Mark:** the sightline eye, an almond outline with a solid pupil.
- **Options:** A `#4CC9F0`, B `#FFB547`, C `#F15BB5`, D `#A3E635`. Rounded chips sit above each player, with a floor ring and a dashed sightline from the ball handler.
- **Motion:** springs with no bounce excess. The freeze frame gets a white flash and an accent scanline. A slow 4.5 % push-in runs during the freeze.

## AntiTiresias — SEE ABSOLUTELY NOTHING.
- **Voice:** sarcastic, absurd, self-aware, fast. **The joke is about the decision, never the person.**
  - No claims about character, effort or intelligence.
  - No body or personal-life jokes.
  - Don't call a turnover a bad read when the evidence says it was a reasonable read with an unlucky outcome. `decisionQuality` must be `poor` for "bad read" framing; the validator warns otherwise.
- **Visuals:**
  - Warm black `#0B0704`, hazard yellow `#FFD400`, warning red `#FF3B1F`.
  - Anton display type, slight rotation, offset red text shadow.
  - Animated hazard stripes frame the footage.
- **Mark:** the same eye, crossed out.
- **Motion:** camera shake on the reveal, a rotated stamp verdict ("GENERATIONAL COURT VISION."), buzzer and boing SFX.

## Editorial rules (both brands)
1. Every stat on screen or on a cover comes from a stored, verified record.
2. Distinguish **actual pass**, **best-supported option** and **unclear**. Never call a read "optimal" without evidence. The explanation screen shows ACTUAL vs BEST-SUPPORTED.
3. Explanations describe what the footage shows: help defence, lanes, rotations.
4. AI-generated text is a draft and is never treated as fact.
5. On-screen text budgets: hook 52 chars, prompt 32, explanation 170, option 30, verdict 32. Text is measured with the real font and shrinks to fit; it is never cropped.
6. Covers use one reusable template per brand. With no authorised headshot, the typography-only layout is used.
7. The first frame is a complete, readable frame. It is often the default thumbnail.

## Covers (both brands share one editorial template)
Template: `packages/video/src/cover.tsx`. Preview every variant with `npm run render:covers -w @tiresias/render-worker`.
- **Page:** cream `#FBF8EF`, ink `#0B0B0C`.
- **Colour block:** 864×700 at (108, 640), filled with the team primary (`packages/core/src/teams.ts`) and overridable per project. The AntiTiresias block is rotated −2.5° with a hazard stripe along its top edge.
- **Type:** Inter Tight 900, lowercase, −0.045em tracking, 0.96 line height.
  - top-left: kicker plus value ("assists: / 13");
  - top-right: eye mark plus brand, with the headline beneath in grey;
  - bottom-left: name / team;
  - bottom-right: verified stat line / plus-minus;
  - footer: series and content ID in mono.
- **Image priority:**
  1. An authorised transparent cutout breaks out of the top of the block.
  2. A framed authorised photo sits inside the block.
  3. A still from the rights-cleared clip is cropped on the ball handler.
  4. Typography only: a giant stat in the block.
- **Never:** team logos or wordmarks (trademarks), unlicensed headshots, or unverified stats.
- Everything that matters sits inside the central 3:4 region (y 240–1680) shown in profile grids.

## Safe areas (1080×1920)
Keep critical text inside x 60–940 and y 150–1500. That clears the platform UI at the top, the caption and nav area at the bottom, and the action rail on the right.
