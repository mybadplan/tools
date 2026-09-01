# tools — GitHub tool registry for Planner

This repo is the **source of truth** for Planner's Tools catalog. Each `.js` file at the repo root is a tool that appears in the app at **Tools → Discover** (`mybadplan/tools` → `https://raw.githubusercontent.com/mybadplan/tools/main/<file>`).

Planner loads tools in 1 request via `catalog.json` (preferred), with fallback to GitHub API directory listing when `catalog.json` is absent.

## Quick start for users

1. Copy this repo's contents (all `*.js` + `catalog.json`) into your fork or into `https://github.com/mybadplan/tools`.
2. In the Planner app open **Tools → Discover** — tools appear automatically with search & pagination.
3. Click **Install** to fetch the tool's source from `raw.githubusercontent.com` and store it offline (IndexedDB + OPFS). Updates pull fresh source and preserve local `data`.

## Adding a new tool

1. Create `my-tool.js` at repo root (flat structure — required for `rawUrlFor` + API fallback). Use kebab-case.
2. Implement the contract below. Minimal example is `template-tool.js`.
3. Run catalog generation and commit both the new file **and** the updated `catalog.json`:

```bash
node generate-catalog.mjs
# or: node example-tools/generate-catalog.mjs if you're running from the planner repo
```

4. Push to `main`. Planner clients fetch `catalog.json` with 5-minute cache; force refresh via **Refresh** button.

## Tool contract

Each file is evaluated in a browser sandbox (`new Function`). Required exports:

```js
const name = "My Tool";                // 1–80 chars, unique across catalog
const description = "Does X";          // 0–300 chars, shown in search
function cooldown() { return 60; }     // seconds before Home can show card again (0..2592000)
function install(ctx) {}               // optional — called on install/re-install
function uninstall(ctx) {}             // optional
async function render(ctx, container, submit) {
  // ctx: { userId, toolId, toolName, data, createTodo/addTodo/registerTodo }
  // data: persisted JSON per tool per user (also available as global `data`)
  // container: HTMLElement — you own the entire card DOM
  // submit(payload): Promise — calls submit(ctx, payload) and persists returned data/todos
  container.innerHTML = '<h1>Hello</h1>';
  // optional cleanup:
  return () => clearInterval(id);
}
function submit(ctx, payload) {        // optional — handles submit() from render
  ctx.data.count = (ctx.data.count || 0) + 1;
  // ctx.createTodo({ title, description, dueAt }) queues a Todo
  return { ok: true };
}
module.exports = { name, description, cooldown, install, uninstall, render, submit };
```

Notes:
- `render` may `await import('https://esm.sh/three@0.160.0')` etc. — network imports are allowed.
- `data` is JSON-cloned and persisted via `submit`. Mutate `ctx.data` or global `data`.
- `createTodo` / `addTodo` inside `render` writes directly to local todos store.
- Validate inputs; sandbox swallows console errors to `ToolFrame`.

## Catalog generation

`generate-catalog.mjs` scans `*.js` (excluding `generate-catalog.mjs`) at repo root, extracts `name`/`description`/`cooldown` via regex + sandboxed `getToolMeta` when available, and writes `catalog.json`:

```json
{
  "generatedAt": "2026-09-01T12:00:00.000Z",
  "repo": "mybadplan/tools",
  "branch": "main",
  "tools": [
    {
      "id": "drink-water-tool",
      "filename": "drink-water-tool.js",
      "name": "Drink Water",
      "description": "Generate a random Drink Water reminder — due in 5 minutes (Todo)",
      "cooldownSeconds": 30,
      "rawUrl": "https://raw.githubusercontent.com/mybadplan/tools/main/drink-water-tool.js"
    }
  ]
}
```

Planner's `fetchRemoteCatalog` prefers `catalog.json` → `index.json` → `tools.json` (in that order) before falling back to `GET /repos/:repo/contents`. Keep `catalog.json` committed for O(1) loads and proper search metadata.

## Search & scale

The Planner UI does client-side filtering (name + description + filename) with debounced input, sort (name/cooldown/filename), and pagination (12 per page, Load more). This scales to hundreds of tools without extra requests. Keep descriptions keyword-rich for discoverability.

## Local development ( Planner repo )

The canonical examples live in `planner/example-tools/` — copy them here to seed the registry, or edit them in place and run:

```bash
node example-tools/generate-catalog.mjs --dir example-tools
```

## Rate limits

Unauthenticated GitHub API has 60 req/hour. `catalog.json` avoids API entirely (raw fetch only). If you rely on API fallback, consider adding `GITHUB_TOKEN` proxy or publishing `catalog.json`.

## License

MIT — tools are user-contributed. Review `render` before installing.
