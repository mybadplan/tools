#!/usr/bin/env node
// generate-catalog.mjs — scans *.js in a directory and emits catalog.json for mybadplan/tools
// Usage:
//   node generate-catalog.mjs
//   node generate-catalog.mjs --dir example-tools
//   node generate-catalog.mjs --repo mybadplan/tools --branch main --dir .

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1]) return args[i + 1];
  if (args.includes(name)) return true;
  return fallback;
}

const repo = arg("--repo", "mybadplan/tools");
const branch = arg("--branch", "main");
const dirArg = arg("--dir", ".");
// resolve relative to cwd
const dir = path.resolve(process.cwd(), dirArg);

if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error(`Directory not found: ${dir}`);
  process.exit(1);
}

function rawUrlFor(filename) {
  return `https://raw.githubusercontent.com/${repo}/${branch}/${filename}`;
}

function toId(filename) {
  return filename.replace(/\.js$/i, "");
}

function quickMeta(code) {
  const nameMatch = code.match(/(?:const|let|var)\s+name\s*=\s*["'`]([^"'`]+)["'`]/);
  const descMatch = code.match(/(?:const|let|var)\s+description\s*=\s*["'`]([^"'`]+)["'`]/);
  const versionMatch = code.match(/(?:const|let|var)\s+version\s*=\s*["'`]([^"'`]+)["'`]/);
  const cooldownFn = code.match(/function\s+cooldown\s*\([^)]*\)\s*\{\s*return\s+(\d+)/);
  const cooldownConst = code.match(/(?:const|let|var)\s+cooldown\s*=\s*(\d+)/);
  let cooldownSeconds = 0;
  if (cooldownFn) cooldownSeconds = parseInt(cooldownFn[1], 10);
  else if (cooldownConst) cooldownSeconds = parseInt(cooldownConst[1], 10);
  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    description: descMatch ? descMatch[1].trim() : "",
    version: versionMatch ? versionMatch[1].trim().slice(0, 32) : null,
    cooldownSeconds,
  };
}

function toTitleCase(filename) {
  const base = filename.replace(/\.js$/i, "").replace(/[-_]+/g, " ");
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".js") && f !== "generate-catalog.mjs" && !f.startsWith("."))
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  console.warn(`No .js tools found in ${dir}`);
}

const tools = files.map((filename) => {
  const full = path.join(dir, filename);
  const code = fs.readFileSync(full, "utf8");
  const meta = quickMeta(code);
  const name = meta.name || toTitleCase(filename);
  const description = meta.description || "";
  const version = meta.version || null;
  const cooldownSeconds = Number.isFinite(meta.cooldownSeconds) ? meta.cooldownSeconds : 0;
  const stat = fs.statSync(full);
  return {
    id: toId(filename),
    filename,
    name: name.slice(0, 80),
    description: description.slice(0, 300),
    version,
    cooldownSeconds: Math.max(0, Math.min(2592000, Math.floor(cooldownSeconds))),
    rawUrl: rawUrlFor(filename),
    size: stat.size,
  };
});

const catalog = {
  generatedAt: new Date().toISOString(),
  repo,
  branch,
  tools,
};

const outPath = path.join(dir, "catalog.json");
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`Wrote ${tools.length} tools → ${outPath}`);
for (const t of tools) console.log(`  - ${t.filename}: "${t.name}" (${t.cooldownSeconds}s)`);

// Optional alias: write index.json if --alias flag is passed
if (args.includes("--alias")) {
  const aliasPath = path.join(dir, "index.json");
  fs.writeFileSync(aliasPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.log(`Also wrote alias → ${aliasPath}`);
}
