---
name: presentation
description: Turns an image file, a scenario, a topic or notes into an editable PowerPoint deck (.pptx) in Tech Drona style, optionally with animated infographic slides. Use for PPT, presentation, slides or pitch deck requests.
argument-hint: "[topic, scenario or image path]"
context: fork
model: sonnet
effort: low
background: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/studio.mjs" *)
---

Make a PowerPoint deck from: $ARGUMENTS

You run unattended: never ask questions; choose sensibly and finish. Commands below use the Bash tool exactly as written. Build the deck only with the studio script (no python-pptx or other tools).

1. **Folder.** WORK = `decks/` if the current folder contains `scripts/studio.mjs`, else `presentations/` (create it).
2. **Input.**
   - **Image file:** first run `node "${CLAUDE_PLUGIN_ROOT}/scripts/studio.mjs" prep "<image path>"`, then Read ONLY the small PNG it prints.
   - **Text:** plan the story as title → one idea per slide → closing, 8–12 slides by default. Mix slide types; use no more than 2 bullet slides in a row, at most 5 bullets of about 12 words each, and put detail in `notes`. Never invent statistics.
3. **Write** `WORK/<short-kebab-name>.json`. The format is below, and it must be plain JSON. Use `"author": "Tech Drona"`.
4. **Build:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/studio.mjs" deck "WORK/<name>.json"` (allow a 10-minute timeout). It auto-fixes most mistakes and prints `Done:`. Do not open the output.
5. **Reply** in at most 6 lines: the `Done:` path and a one-line outline.

```json
{ "title": "...", "author": "Tech Drona", "slides": [
  { "type": "title", "title": "...", "subtitle": "...", "notes": "speaker notes (any slide)" },
  { "type": "section", "title": "...", "subtitle": "..." },
  { "type": "bullets", "title": "...", "bullets": ["point", { "text": "point", "sub": ["detail"] }] },
  { "type": "two-column", "title": "...", "left": { "heading": "...", "bullets": ["..."] }, "right": { "heading": "...", "bullets": ["..."] } },
  { "type": "stats", "title": "...", "stats": [{ "value": "12", "label": "Courses" }], "note": "small text" },
  { "type": "process", "title": "...", "steps": [{ "title": "Enquire", "text": "short line" }] },
  { "type": "cards", "title": "...", "cards": [{ "icon": "🎥", "title": "...", "text": "..." }] },
  { "type": "table", "title": "...", "columns": ["A", "B"], "rows": [["1", "2"]] },
  { "type": "image", "title": "...", "image": "path.png", "caption": "..." },
  { "type": "infographic", "title": "...", "data": { } },
  { "type": "quote", "quote": "...", "by": "..." },
  { "type": "closing", "title": "Thank you", "subtitle": "call to action" } ] }
```

Limits: up to 4 stats, 6 process steps, 6 cards and about 8 table rows.

**Infographic slides** become an animated 16:9 video that plays in the slide, and each takes about 30 s to render. Use at most one per deck. Only when you use one, Read `${CLAUDE_PLUGIN_ROOT}/skills/animated-infographic/schema.md` for the `data` format, and keep it to 5 rows or fewer.
