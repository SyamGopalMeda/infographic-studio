---
name: presentation
description: Turn an image, a scenario, a topic or notes into an editable PowerPoint deck (.pptx) in Tech Drona style, with optional animated infographic slides that play as video. Use when the user asks for a PPT, presentation, slides, slide deck or pitch deck.
---

# Presentation (.pptx) from an image or a scenario

Every deck is built by ONE studio script from a deck JSON file. Your job is to write that file.
Never hand-build slides another way (no python-pptx, no other PowerPoint skill).

## Where things are (works from any folder)

- **STUDIO** = two folders above this skill's base directory (base directory `…/skills/presentation` →
  STUDIO is `…`). It contains `scripts/studio.mjs`.
- **WORK** = where the deck file goes: `decks/` if the current folder IS the studio (it has
  `scripts/studio.mjs`), otherwise `presentations/` in the current folder (create it).
- Output: `out/<name>/presentation.pptx` in the studio, else `presentations/<name>/presentation.pptx`.

You may be running unattended (headless): do not ask questions. Make sensible choices and finish.

## Steps

1. **Understand the input.**
   - Image: Read it. If it shows slides, a diagram or notes, use its content and structure. If it is a photo,
     work out the topic.
   - Scenario / topic / notes: plan a clear story.
   - Use the user's brand: `"author": "Tech Drona"` unless told otherwise. Never copy another creator's name.
2. **Plan the story:** title, then 1 slide per idea, then closing. Default 8–12 slides.
   - Mix slide types. Avoid more than 2 bullet slides in a row; use process, stats, cards, two-column or table
     where the content has that shape.
   - Max 5 bullets per slide, max ~12 words per bullet. Put the details in `notes` (speaker notes).
   - Never invent statistics. If a number is unknown, use a non-numeric slide, or mark it
     "example — replace" in a `note`.
3. **Write `WORK/<short-kebab-name>.json`** (schema below). It must be plain, valid JSON.
4. **Build** (skip this if you were told the caller renders it):
   `node "STUDIO/scripts/studio.mjs" deck "WORK/<name>.json"`
   - Use the real absolute STUDIO path in quotes. Allow a timeout of at least 10 minutes: the first run
     installs packages, and each infographic slide takes about 30 s to render.
5. **Reply** with the output path and a one-line outline of the deck.

## Deck schema

```json
{
  "title": "Learning at Tech Drona",
  "author": "Tech Drona",
  "theme": { "primary": "#1B7A1B", "secondary": "#5552C9" },
  "slides": [
    { "type": "title", "title": "...", "subtitle": "...", "notes": "speaker notes (any slide)" },
    { "type": "section", "title": "...", "subtitle": "..." },
    { "type": "bullets", "title": "...", "bullets": ["point", { "text": "point", "sub": ["detail", "detail"] }] },
    { "type": "two-column", "title": "...", "left": { "heading": "...", "bullets": ["..."] }, "right": { "heading": "...", "bullets": ["..."] } },
    { "type": "stats", "title": "...", "stats": [{ "value": "12", "label": "Courses" }], "note": "optional small text" },
    { "type": "process", "title": "...", "steps": [{ "title": "Enquire", "text": "one short line" }] },
    { "type": "cards", "title": "...", "cards": [{ "icon": "🎥", "title": "...", "text": "..." }] },
    { "type": "table", "title": "...", "columns": ["A", "B"], "rows": [["1", "2"]] },
    { "type": "image", "title": "...", "image": "input/photo.png", "caption": "..." },
    { "type": "infographic", "title": "...", "data": { "...animated-infographic data, see below..." } },
    { "type": "quote", "quote": "...", "by": "..." },
    { "type": "closing", "title": "Thank you", "subtitle": "contact / call to action" }
  ]
}
```

Limits: stats up to 4, process up to 6 steps, cards up to 6, table up to ~8 rows.

### Infographic slides (animated)
- `"data"` is exactly the data format of the `animated-infographic` skill
  (`STUDIO/skills/animated-infographic/SKILL.md`): title, rows, items, tools, from…
- It is rendered automatically as a 16:9 video that plays in the slide. Rendering takes about 30 s per slide, so
  use at most 1–2 per deck, for the system/stack/flow overview.
- Or point at an existing file: `"dataFile": "data/example.json"`.
- In 16:9 keep it shorter: max ~5 rows, max 5 items per row.

### Images
- `"image"` and `"dataFile"` paths may be absolute, or relative to the deck file, the current folder or STUDIO.
