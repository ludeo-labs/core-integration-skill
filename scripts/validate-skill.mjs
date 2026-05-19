#!/usr/bin/env node
// Validates SKILL.md against the Agent Skills spec (https://agentskills.io/specification)
// and our local conventions. Zero npm dependencies so it runs everywhere.
//
// Exit codes:
//   0 — all checks passed (warnings allowed)
//   1 — one or more errors

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_PATH = join(ROOT, "SKILL.md");
const REFERENCES_DIR = join(ROOT, "references");
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME = 64;
const MAX_DESC = 1024;
const MAX_BODY_LINES = 500;

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

function readFile(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    fail(`Cannot read ${relative(ROOT, path)}: ${e.message}`);
    return null;
  }
}

// Minimal YAML frontmatter parser — enough for our needs (top-level scalars
// and the `metadata:` map). Supports quoted/unquoted scalars and one level of
// nested mapping. NOT a general YAML parser.
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const lines = match[1].split(/\r?\n/);
  const out = {};
  let currentKey = null;
  let currentIndent = 0;
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (indent === 0) {
      const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (!m) continue;
      const [, key, rest] = m;
      if (rest === "") {
        out[key] = {};
        currentKey = key;
        currentIndent = indent;
      } else {
        out[key] = unquote(rest);
        currentKey = null;
      }
    } else if (currentKey && indent > currentIndent) {
      const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (!m) continue;
      const [, key, rest] = m;
      out[currentKey][key] = unquote(rest);
    }
  }
  return { raw: match[1], data: out };
}

function unquote(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// --- 1. SKILL.md frontmatter checks --------------------------------------------------

const skillText = readFile(SKILL_PATH);
if (!skillText) {
  console.error("FAIL: SKILL.md missing");
  process.exit(1);
}

const fm = parseFrontmatter(skillText);
if (!fm) {
  fail("SKILL.md is missing YAML frontmatter (--- ... ---)");
} else {
  const { name, description, metadata } = fm.data;

  if (!name) fail("frontmatter.name is required");
  else if (name.length > MAX_NAME) fail(`frontmatter.name exceeds ${MAX_NAME} chars`);
  else if (!NAME_RE.test(name))
    fail(`frontmatter.name "${name}" must match /^[a-z0-9]+(-[a-z0-9]+)*$/`);

  if (!description) fail("frontmatter.description is required");
  else if (description.length === 0) fail("frontmatter.description is empty");
  else if (description.length > MAX_DESC)
    fail(`frontmatter.description exceeds ${MAX_DESC} chars (${description.length})`);

  if (!metadata || typeof metadata !== "object" || !metadata.version) {
    warn("frontmatter.metadata.version not set — release pipeline will stamp it on first release");
  } else if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(metadata.version)) {
    fail(`frontmatter.metadata.version "${metadata.version}" is not valid semver`);
  }
}

// --- 2. Body length convention ------------------------------------------------------

const body = skillText.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
const bodyLines = body.split(/\r?\n/).length;
if (bodyLines > MAX_BODY_LINES) {
  warn(
    `SKILL.md body is ${bodyLines} lines (>${MAX_BODY_LINES}). Consider moving detail into references/.`
  );
}

// --- 3. Reference path integrity ---------------------------------------------------

const filesToScan = [SKILL_PATH];
if (existsSync(REFERENCES_DIR)) {
  for (const entry of walk(REFERENCES_DIR)) {
    if (entry.endsWith(".md")) filesToScan.push(entry);
  }
}

const PATH_RE = /(?:^|[\s(`'"])((?:\.{0,2}\/)?(?:references|learnings|tools|config|examples|scripts)\/[\w./-]+)/g;

for (const file of filesToScan) {
  const text = readFile(file);
  if (!text) continue;
  for (const match of text.matchAll(PATH_RE)) {
    const ref = match[1].replace(/[.,;:!?)\]]+$/, "");
    if (ref.includes("..") || ref.includes("<") || ref.includes(">")) continue;
    if (ref.includes("*")) continue;
    if (ref.endsWith("/")) continue;
    if (!ref.match(/\.(md|json|ps1|bat|py|sh|cs|cpp|h|uplugin|uproject|Build\.cs)$/i))
      continue;
    const abs = join(ROOT, ref);
    if (!existsSync(abs)) {
      warn(`${relative(ROOT, file)}: dangling reference -> ${ref}`);
    }
  }
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

// --- 4. Required top-level layout ----------------------------------------------------

const REQUIRED = ["SKILL.md", "references", "learnings", "tools"];
for (const p of REQUIRED) {
  if (!existsSync(join(ROOT, p))) fail(`Required entry missing at repo root: ${p}`);
}

// --- 5. Report -----------------------------------------------------------------------

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);

console.log(
  `\nSKILL.md: ${errors.length} error(s), ${warnings.length} warning(s), ${bodyLines} body lines`
);

process.exit(errors.length > 0 ? 1 : 0);
