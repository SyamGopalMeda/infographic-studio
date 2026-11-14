---
name: animated-infographic
description: Turn any image (an infographic, flowchart, tech-stack diagram, whiteboard photo, slide or sketch) OR a written scenario/topic into an animated LinkedIn infographic with layered boxes, logos and dots moving along the connector lines, exported as HTML + MP4 + GIF. Use when the user gives an image, a scenario, a process or a topic and asks for an infographic, animated diagram, flowchart animation, or LinkedIn post visual.
---

# Animated infographic from an image

The whole visual is produced by ONE fixed template (`template/infographic.html`). Your only job is to write a
data file that describes the content, then run the make script. Never edit the template for a single post.

## Steps

You run unattended (often headless): do not ask questions — make sensible choices and finish.

1. **Understand the input.**
   - **Image** (use the Read tool on its path; if pasted, it is already visible):
     - Diagram/infographic: capture its structure top to bottom: title, subtitle, each layer, each box,
       the tools/logos in each box, and which boxes connect to which.
     - Anything else (photo, slide, notes, screenshot, a single logo): work out the topic and design a
       sensible layered flow for it.
   - **Scenario / text** (e.g. "how a student gets a certificate", "our hiring process", "a food delivery app"):
     turn it into a top-to-bottom flow. Typical shapes:
     - process: trigger(s) → stages (bars) → details per stage (groups) → outcome (final)
     - system/stack: users/channels (cards) → categories (bars) → tools (groups with real logos) → hub (bar) → outcome
     - comparison: one `card` per option → `group` of pros/features each → verdict (final)
     Use real, accurate tool/brand names only where the scenario implies technology; otherwise use emoji icons.
   - If both an image and a topic are given, the topic wins; use the image for style/structure.
2. **Make it ours, not a copy.** Use the user's brand in `author` (default `{"name":"Tech Drona","handle":"@techdrona"}`)
   — never the original creator's name or photo. Reword titles/labels; keep facts. If the image is someone else's
   post, say in your reply that the result is "inspired by" it.
3. **Write `data/<short-kebab-name>.json`** following the schema below. Fit to one 1080×1350 portrait frame:
   max ~7 rows, max 6 items per row, max 4 tools per group, labels ≤ 4 words.
4. **Run** from the project root:
   `node scripts/make.mjs data/<name>.json`
   (HTML preview only, faster: add `--no-video`.) Rendering takes about 1 minute.
5. **Check it.** Read `out/<name>/infographic.html` back only if the script errored. If logos show as a coloured
   letter, the simple-icons slug was wrong: fix the slug (or use `"icon": "<emoji>"`) and re-run.
6. **Reply** with the three output paths (HTML, MP4, GIF), one line saying what the diagram shows, and a short
   LinkedIn caption (hook line, 3 lines of value, 3–5 hashtags).

## Data schema

(The `//` comments below are explanations only. The real file must be plain JSON with no comments.)

```json
{
  "title": "The AI Agent",            // first part of headline (secondary colour)
  "titleAccent": "Stack",              // optional second part (primary colour)
  "subtitle": "Which tool I'd use for every job",
  "author": { "name": "Tech Drona", "handle": "@techdrona", "photo": "optional image URL" },
  "theme": { "primary": "#1B7A1B", "secondary": "#5552C9", "bg": "#ffffff", "tintA": "#EEF6EC", "tintB": "#EEEEFA", "line": "#22252b", "dot": "#2E7D32" },
  "animation": { "loopSeconds": 3, "dotsPerWire": 1, "dotRadius": 5 },
  "rows": [
    { "style": "card",  "items": [ { "id": "web", "label": "Web App", "icon": "🖥️" } ] },
    { "style": "bar",   "items": [ { "id": "chat", "label": "Chat Interface", "from": ["web"] } ] },
    { "style": "group", "tint": "a", "items": [
        { "id": "fe", "label": "Chat Frontend", "from": ["chat"], "cols": 1,
          "tools": [ { "name": "Vercel AI SDK", "logo": "vercel" }, { "name": "CopilotKit", "icon": "🤖" } ] } ] },
    { "style": "chips", "tint": "a", "items": [ { "id": "models", "tools": [ { "name": "Claude", "logo": "claude" } ] } ] },
    { "style": "panel", "items": [ { "id": "deploy", "label": "Deploy & Scale", "tools": [ { "name": "Docker", "logo": "docker" } ] } ] },
    { "style": "final", "items": [ { "id": "live", "label": "Agent live in production" } ] }
  ]
}
```

Row styles:
- `card` — big primary-colour tiles with a round icon on top (best for the top row of inputs/channels).
- `bar` — solid secondary-colour heading bars (categories, single hub like "Orchestration"). `"variant": "green"` makes one primary-coloured.
- `group` — header + list of tools with logos (the main body). `"variant": "purple"` for secondary header; `cols` 1 or 2.
- `chips` — one horizontal strip of logos (e.g. model providers).
- `panel` — light box with a title and inline tools.
- `final` — the highlighted outcome at the bottom.
- Optional per row: `"tint": "a"` (green wash) or `"b"` (purple wash) background; `"connect": false` to draw no wires into this row.

Connections: put `"from": ["parentId", ...]` on an item. Without `from`, items auto-connect to the row above
(one-to-many, many-to-one, or proportionally by position). Every `id` must be unique.

Logos, in order of preference:
- `"logo": "<simple-icons slug>"` — lowercase brand name with no spaces/dots: `react`, `nodedotjs`, `googlecloud`,
  `firebase`, `docker`, `openai`, `claude`, `googlegemini`, `langchain`, `supabase`, `redis`, `whatsapp`, `telegram`,
  `gmail`, `n8n`, `zapier`, `cloudflare`, `vercel`, `github`, `python`, `postgresql`, `mongodb`, `stripe`.
  Check unsure slugs at https://simpleicons.org.
- `"logoUrl": "https://..."` — any image URL.
- `"icon": "🔐"` — an emoji, for concepts or brands that simple-icons does not have.
- nothing — a coloured circle with the first letter is shown.
