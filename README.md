# Infographic Studio

Give it an **image** or a **written scenario**. You get back either:

- **Animated infographic**: layered boxes, logos, and dots moving along the lines. Output is MP4 + GIF + a one-slide PPTX + an HTML preview, sized 1080×1350 for the LinkedIn feed.
- **PowerPoint presentation**: an editable `.pptx` in Tech Drona style. Slides can include animated infographic videos that play inside the slide.

It is also a **Claude Code plugin** (like HyperFrames). Once installed, it works in **every folder**, not only this one.

Installing it **also installs HyperFrames** (HeyGen's open-source video plugin) as a dependency. Claude can then use HyperFrames for any general video work, such as promos, reels and animated intros. The infographic and PPT features don't use HyperFrames; they work on their own.

## New laptop (one time)
```
git clone https://github.com/SyamGopalMeda/infographic-studio.git
cd infographic-studio
```
1. Double-click **`setup.bat`**. It does all of this:
   - installs Node.js and Claude Code if they are missing
   - installs the packages and the recorder
   - test-builds an example video and an example deck
   - installs **this studio as a Claude plugin from GitHub**, which also brings **HyperFrames**
2. Open a terminal, type `claude`, and **sign in once**.

### Install only the plugin (no clone needed)
Any laptop with Claude Code and Node.js can install it with two commands:
```
claude plugin marketplace add SyamGopalMeda/infographic-studio
claude plugin install infographic-studio@tech-drona
```
This also installs **HyperFrames** automatically. The first time a skill renders, it installs its packages by itself, which takes 1–2 minutes. The `.bat` files need the cloned repo.

### Update after changes
Run `git pull`, then `claude plugin marketplace update tech-drona`, then `claude plugin update infographic-studio@tech-drona`. Restart Claude.

## Use it
| You want | Do this |
|---|---|
| Animated infographic | Drag an image onto **`create.bat`**, or double-click it and type a scenario |
| PowerPoint deck | Drag an image onto **`deck.bat`**, or double-click it and type a topic or scenario |
| Automatic | Run **`watch.bat`**. Drop images or `.txt` files into `inbox\` for an infographic, or into `inbox\deck\` for a deck |
| From **any folder** (plugin) | Run `claude` there and ask, e.g. "make an animated infographic of our admission process" or "make a PPT about our Python course". You can also type `/infographic-studio:animated-infographic` or `/infographic-studio:presentation`. Output goes to `infographics\` or `presentations\` in that folder. |
| Advanced video (HyperFrames) | Run `claude` and ask, e.g. "make a 20-second promo video for our Python course with HyperFrames" |

Each job takes about 1–3 minutes, then the result folder opens: `out\<name>\`.
- Infographic: `infographic.mp4` (post this on LinkedIn), `infographic.gif`, `infographic.pptx`, `poster.png`
- Deck: `presentation.pptx`

## Edit and rebuild without Claude
- Infographic: edit `data\<name>.json`, then run `node scripts\make.mjs data\<name>.json`
  - Options: `--format landscape` (16:9) or `--format square`, `--pptx`, `--no-gif`, `--no-video` (HTML only)
- Deck: edit `decks\<name>.json`, then run `node scripts\deck.mjs decks\<name>.json`
- You can also open the `.pptx` and edit it directly in PowerPoint.

## How it works
1. `scripts/create.mjs` sends the image or scenario to Claude Code, running headless with a project skill.
2. Claude writes **only a JSON file**: `data/<name>.json` for an infographic, or `decks/<name>.json` for a deck.
3. The scripts render it:
   - `make.mjs` fills the fixed template, records it frame by frame in headless Chrome, and encodes it with ffmpeg.
   - `deck.mjs` builds the slides with PptxGenJS.

The design is always consistent, and you can always fix the text by hand.

| Path | What |
|---|---|
| `skills/animated-infographic/` | Infographic instructions for Claude, plus the data format |
| `skills/presentation/` | Deck instructions for Claude, plus the slide types |
| `.claude-plugin/` | Plugin and marketplace files (what makes it installable like HyperFrames) |
| `scripts/studio.mjs` | Entry point the skills call from any folder (installs packages on first use) |
| `template/infographic.html` | Infographic design (colours, layout, moving dots) |
| `data/`, `decks/` | One JSON per infographic or deck (`example*.json` are samples) |
| `out/`, `input/`, `inbox/` | Generated files and inputs (not in git) |

## Notes
- Windows only (the `.bat` files). You must be **online**: Claude, the logos, and the fonts are fetched from the internet.
- Each laptop needs its own Claude sign-in.
- When used inside another project (for example the LMS repo), add `infographics/` and `presentations/` to that project's `.gitignore` if you don't want to commit them.
- Brand defaults to **Tech Drona**. If the input is someone else's post, the result is only *inspired by* it, so reword it before posting.
- A logo showing as a coloured letter means the logo name was wrong. Fix `"logo"` (check https://simpleicons.org) and rebuild.
- Video in PPTX plays in PowerPoint desktop. Some online viewers show only the still poster image.
