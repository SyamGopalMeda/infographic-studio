# Infographic Studio

Give it an **image** or a **written scenario**, and you get an **animated LinkedIn infographic**: layered boxes, logos, and dots moving along the lines. The output is 1080×1350, as MP4 + GIF + HTML preview.

## New laptop (one time)
```
git clone <this-repo-url>
cd infographic-studio
```
1. Double-click **`setup.bat`**. It installs Node.js and Claude Code if they are missing, the packages, and the recorder.
2. Open a terminal, type `claude`, and **sign in once**.

## Make an infographic
| Way | How |
|---|---|
| **Drag & drop** | Drag an image onto **`create.bat`** |
| **Type a scenario** | Double-click `create.bat` and type e.g. `how a student gets a certificate` |
| **Auto mode** | Run **`watch.bat`**, then drop images or `.txt` scenario files into the `inbox` folder. Each one is converted automatically. |
| **Terminal** | `node scripts/create.mjs "path\to\image.png"` or `node scripts/create.mjs "your scenario"` |
| **Inside Claude Code** | `claude`, then `/animated-infographic path\to\image.png` |

It takes about 1–3 minutes. The result folder opens by itself: `out\<name>\infographic.mp4`. **Post the MP4 on LinkedIn.**

## Edit and re-render without Claude
Change the text in `data\<name>.json`, then run:
```
node scripts\make.mjs data\<name>.json
```
Add `--no-video` for a quick HTML preview only.

## How it works
1. `scripts/create.mjs` gives the image or scenario to Claude Code, which runs headless with the project skill.
2. Claude writes only a **data file** (`data/<name>.json`): the title, rows, boxes, tools, logos and connections.
3. `scripts/make.mjs` puts that data into **one fixed template** (`template/infographic.html`). It then records the animation frame by frame in a headless browser and encodes it with ffmpeg.

Every post therefore has the same consistent look, and you can always fix the text by hand.

| Path | What |
|---|---|
| `.claude/skills/animated-infographic/SKILL.md` | Instructions for Claude, plus the data format |
| `template/infographic.html` | The design (colours, layout, moving dots) |
| `data/` | One JSON per post (`example.json` = stack, `example-scenario.json` = process) |
| `out/`, `input/`, `inbox/` | Generated files and inputs (not in git) |

## Notes
- You must be **online**: Claude, the logos (simpleicons.org) and the font (Google Fonts) are all fetched from the internet.
- Brand defaults to **Tech Drona**. If the input is someone else's post, the result is a remake *inspired by* it; reword it before posting.
- Logo shows as a coloured letter? The logo name was wrong. Fix `"logo"` in the data file (check https://simpleicons.org) and re-render.
- Change the colours for all posts in `theme`, or edit the `:root` colours in the template.
