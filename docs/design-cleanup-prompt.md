I'm designing the visual templates for **Tiresias**, a basketball content brand. Each post freezes a real NBA play right before a pass and asks the viewer to pick the read, then reveals what the passer actually did. Tagline: "See what the box score can't." Series name: "Court Vision".

Please clean up and elevate two templates: a **vertical video template** and a **cover image**. I've attached screenshots of how they look today: a contact sheet showing one frame per scene, plus a few covers. Keep the concept and structure. Make them look premium, editorial and confident, like a sports magazine or a high-end data-viz studio, not a generic sports-highlight template.

## Hard constraints (the render pipeline depends on these)

- **Canvas:** 1080×1920 for both, 30 fps for video.
- **Platform safe areas:** TikTok, Reels and Shorts cover the top 150 px, everything below y=1500, and the right rail (x > 940). All critical text must sit inside x 60–940, y 150–1500.
- **Footage panel:** full-width window at y 330–1210 (1080×880). Broadcast footage (16:9, often only 720p) is zoomed and cropped into it automatically. Don't plan art that relies on the footage being sharp at high zoom.
- **Fonts:** only these bundled OFL fonts.
  - Inter Tight: 500, 700, 800, 900, plus italic 800 and 900
  - Anton
  - JetBrains Mono: 500, 700, 800
- **Text fits automatically.** It must work with long names (e.g. "Shai Gilgeous-Alexander", "Nikola Jokić") and hooks up to 64 characters.
- **Option colours:** A–D each need a distinct, high-contrast colour that reads over busy footage. Current: A #4CC9F0, B #FFB547, C #F15BB5, D #A3E635.
- **No invented data.** The stat line and stat value are optional and often missing. The design must look finished without them; never use placeholder numbers.
- **Logos:** no NBA or team logos and no player headshots unless separately licensed. Team identity may only use colour and text.

## Current brand tokens (refine them, but tell me what you changed)

- Background #05070A, elevated surface #0C1117, ink #F3F1EC, muted ink #8A94A3
- Accent mint #5BE7C4 on accent ink #03130E, danger #FF5D5D, hairlines at 14% ink
- Brand mark: an eye glyph plus the lowercase/uppercase wordmark "tiresias"
- Cover palette: cream paper #FBF8EF, near-black ink #0B0B0C, team-colour block (default #C8323C)

## Video template (22 s, 6 scenes)

Content fields per video:
- **Hook:** e.g. "CAN YOU SEE THE PASS BEFORE JRUE DOES?"
- **Player:** name, team, game label (e.g. "POR vs NYK · Q4 1:07")
- **Options:** 2–4, each a letter and a short description of up to 48 characters, e.g. "Right-wing shooter", anchored to a player's position in the frame
- **Read:** the actual read, plus an optional "best-supported" read
- **Explanation:** up to 200 characters

Scenes:
1. **Hook (3 s):** footage plays toward the freeze. The hook headline sits at the top; player name, team and game label sit below the panel.
2. **Decision (4 s):** footage freezes.
   - Lettered chips float above each option player, with a ring at their feet; a small "BALL" tag marks the passer.
   - The prompt reads "WHAT'S THE READ?".
   - A legend below the panel lists A–D with descriptions.
3. **Countdown (3 s):** same freeze with a 3-2-1 ring timer.
4. **Reveal (4 s):**
   - "ACTUAL READ: [B] RIGHT-WING SHOOTER"; the other options dim.
   - It holds briefly, then the footage plays the pass with a receiver highlight.
5. **Explanation (5 s):** slow-motion replay (0.5×) with the "THE READ" eyebrow plus the explanation text, and a small "ACTUAL / BEST-SUPPORTED" readout.
6. **Outro (3 s):** blurred footage, "DID YOU SEE IT?", a mint "COMMENT YOUR PICK." pill, and the wordmark with the tagline.

Rough edges I want fixed:
- The header hook is small and cramped.
- The option legend is small and floats in a large empty dark area below the panel.
- The "BALL" tag is tiny.
- "BEST-SUPPORTED: UNCLEAR" reads like jargon.
- The outro feels like an afterthought.
- Overall hierarchy and spacing need a real typographic system: scale, grid and consistent margins.

## Cover image (1080×1920; the profile grid crops to the central 3:4, y ≈ 240–1680)

Today it's an editorial layout on cream paper:
- **Top left:** a heavy lowercase kicker ("pick the pass").
- **Top right:** the eye mark, "tiresias" and a grey headline ("can you see the pass?").
- **Centre:** a solid team-colour block (864×700 at x 108, y 640) holding a still from the clip, centred on the passer at the freeze moment, with a colour vignette.
- **Below the block:** player name and team in heavy lowercase.
- **Bottom right:** an optional verified stat line (e.g. "24p/6r/13a", "+21").
- **Footer:** series name and content ID in mono.
- When a licensed transparent cutout exists, it breaks out of the top of the block.

Rough edges I want fixed:
- There's lots of dead cream space above and below.
- The kicker is identical on every cover, so the grid looks repetitive.
- The headline is small and low-contrast.
- The red vignette washes the footage pink.
- Without a stat line, the bottom right feels empty.
- The covers need to read instantly as a set at thumbnail size in a 3-column profile grid, while each one stays distinguishable.

## What I want back

1. A short design rationale: type scale, grid, colour changes, and how the hierarchy works.
2. Mockups of the cover (with and without a stat line, short and long player names) and of each of the 6 video scenes.
3. Exact specs I can hand to a developer: positions in px on the 1080×1920 canvas, font, weight, size, letter-spacing and colour for every element, and animation notes (easing, duration) for scene transitions and chip and reveal motion.
4. If you write code: React components using inline styles, so they drop into Remotion. No external CSS frameworks, and no assets beyond the fonts above.
