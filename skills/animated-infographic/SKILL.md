---
name: animated-infographic
description: Turns an image file or a written scenario into an animated LinkedIn infographic (layered boxes, logos, moving dots) as MP4, GIF and PPTX in Tech Drona style. Use for infographic, animated diagram, flowchart or tech-stack visual requests.
argument-hint: "[image path or scenario] [optional: landscape|square]"
context: fork
model: sonnet
effort: low
background: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/studio.mjs" *)
---

Make an animated infographic from: $ARGUMENTS

You run unattended: never ask questions; choose sensibly and finish. Commands below use the Bash tool exactly as written.

1. **Folder.** WORK = `data/` if the current folder contains `scripts/studio.mjs`, else `infographics/` (create it).
2. **Input.**
   - **Image file:** first run `node "${CLAUDE_PLUGIN_ROOT}/scripts/studio.mjs" prep "<image path>"`, then Read ONLY the small PNG path it prints. From a diagram, keep its structure (layers, boxes, tools, links). For any other picture, design a flow for its topic.
   - **Scenario or topic:** design a top-to-bottom flow, such as triggers → stages (bar) → details (group) → outcome (final), or channels (card) → categories (bar) → tools (group) → outcome.
   - Use real brand names only for real technology; otherwise use emoji icons.
3. **Brand.** `"author": {"name":"Tech Drona","handle":"@techdrona"}`, never the original creator's. Reword labels and keep facts.
4. **Write** `WORK/<short-kebab-name>.json` in the format in `${CLAUDE_SKILL_DIR}/schema.md` (Read it).
5. **Render:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/studio.mjs" make "WORK/<name>.json" --pptx` (add `--format landscape` if asked). Allow a 10-minute timeout; the first run installs packages.
   - The script fixes most mistakes by itself and prints a `summary:` line. Do not open or Read the output images.
   - Only if the summary says `ISSUES`, edit the JSON once and render again.
6. **Reply** in at most 8 lines: the `Done:` folder, one line on what it shows, and a LinkedIn caption (a hook, 2–3 value lines and 3–5 hashtags). If the input was someone else's post, say it is "inspired by" it.
