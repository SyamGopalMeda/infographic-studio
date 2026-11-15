# Infographic data format

Plain JSON (no comments). Fits one frame: max ~7 rows, 6 items per row, 4 tools per group, labels of 4 words or fewer.

```json
{
  "title": "The AI Agent", "titleAccent": "Stack",
  "subtitle": "Which tool to use for every job",
  "author": { "name": "Tech Drona", "handle": "@techdrona" },
  "rows": [
    { "style": "card",  "items": [ { "id": "web", "label": "Web App", "icon": "🖥️" } ] },
    { "style": "bar",   "items": [ { "id": "chat", "label": "Chat Interface", "from": ["web"] } ] },
    { "style": "group", "tint": "a", "items": [ { "id": "fe", "label": "Frontend", "from": ["chat"],
        "tools": [ { "name": "React", "logo": "react" }, { "name": "CopilotKit", "icon": "🤖" } ] } ] },
    { "style": "chips", "items": [ { "id": "models", "tools": [ { "name": "Claude", "logo": "claude" } ] } ] },
    { "style": "panel", "items": [ { "id": "deploy", "label": "Deploy", "tools": [ { "name": "Docker", "logo": "docker" } ] } ] },
    { "style": "final", "items": [ { "id": "live", "label": "Agent live in production" } ] }
  ]
}
```

Optional top-level fields: `"format": "landscape"|"square"` (default portrait); `"theme": {"primary":"#1B7A1B","secondary":"#5552C9"}`; `"animation": {"loopSeconds":3}`.

Row styles: `card` (big tiles with a round icon, use for the top inputs), `bar` (heading bar or hub; `"variant":"green"`), `group` (header plus tool list, the main body; `"variant":"purple"`, `"cols":1|2`), `chips` (one strip of logos), `panel` (light box with title and inline tools), `final` (the outcome at the bottom). Optional per row: `"tint":"a"|"b"`, `"connect":false`.

Links: `"from": ["id"]` must name items in the row DIRECTLY above. Without `from`, items connect to the row above automatically. Ids must be unique. Steps that follow each other go in separate rows.

Icons: `"logo": "<simple-icons slug>"`, a lowercase brand name with no spaces (`react`, `nodedotjs`, `googlecloud`, `firebase`, `docker`, `claude`, `python`, `github`, `stripe`, `whatsapp`). The checker fixes or drops bad slugs. Use `"icon": "<emoji>"` for concepts. `"logoUrl"` takes any image URL.
