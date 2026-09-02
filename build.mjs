#!/usr/bin/env node
/**
 * Baut aus dem Ordner `src/` eine statische Seite in `dist/`.
 *
 * - Alle Dateien aus `src/` werden 1:1 nach `dist/` kopiert.
 * - `dist/index.html` wird neu erzeugt: Unterordner werden zu Überschriften,
 *   die enthaltenen Dateien zu Links (Titel aus <title> bzw. <h1>).
 *
 * Keine Abhängigkeiten – läuft mit reinem Node (>= 18).
 */

import { readdir, readFile, mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { join, relative, extname, sep, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

const SITE_TITLE = "Informatik – Arbeitsblätter";
const SITE_SUBTITLE = "Interaktive Materialien und Lernkurse";

/* ---------------------------------------------------------------- Dateibaum */

/** Liest `src/` rekursiv und liefert eine sortierte Baumstruktur. */
async function readTree(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const dirs = [];
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      dirs.push({ name: entry.name, path: full, ...(await readTree(full)) });
    } else if (entry.isFile()) {
      files.push({ name: entry.name, path: full });
    }
  }

  const byName = (a, b) => a.name.localeCompare(b.name, "de", { numeric: true });
  dirs.sort(byName);
  files.sort(byName);
  return { dirs, files };
}

/* -------------------------------------------------------------- Metadaten */

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** Ermittelt einen lesbaren Titel für eine Datei. */
async function fileMeta(file) {
  const ext = extname(file.name).toLowerCase();
  const fallback = basename(file.name, ext);

  if (ext === ".html" || ext === ".htm") {
    try {
      const html = await readFile(file.path, "utf8");
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const raw = (title?.[1] || h1?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const desc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      return {
        title: decodeEntities(raw) || fallback,
        description: desc ? decodeEntities(desc[1]) : "",
      };
    } catch {
      /* ignore */
    }
  }
  return { title: fallback, description: "" };
}

const ICONS = {
  ".html": "🌐", ".htm": "🌐",
  ".pdf": "📄", ".md": "📝", ".txt": "📝",
  ".zip": "🗜️",
  ".png": "🖼️", ".jpg": "🖼️", ".jpeg": "🖼️", ".gif": "🖼️", ".svg": "🖼️",
};

/* ------------------------------------------------------------------ HTML */

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const href = (p) => relative(SRC, p).split(sep).map(encodeURIComponent).join("/");

async function renderFiles(files) {
  if (!files.length) return "";
  const items = await Promise.all(
    files.map(async (f) => {
      const meta = await fileMeta(f);
      const icon = ICONS[extname(f.name).toLowerCase()] || "📎";
      return `        <li class="card">
          <a href="${esc(href(f.path))}">
            <span class="card__icon" aria-hidden="true">${icon}</span>
            <span class="card__text">
              <span class="card__title">${esc(meta.title)}</span>
              ${meta.description ? `<span class="card__desc">${esc(meta.description)}</span>` : ""}
            </span>
          </a>
        </li>`;
    })
  );
  return `      <ul class="cards">\n${items.join("\n")}\n      </ul>`;
}

async function renderTree(node, depth = 0) {
  let out = "";
  if (node.files?.length && depth > 0) {
    out += (await renderFiles(node.files)) + "\n";
  }
  for (const dir of node.dirs) {
    const level = Math.min(depth + 2, 4); // h2..h4
    const count = countFiles(dir);
    out += `      <section class="group group--l${depth}">
        <h${level} class="group__title">${esc(dir.name)}<span class="group__count">${count}</span></h${level}>
`;
    out += await renderTree(dir, depth + 1);
    out += `      </section>\n`;
  }
  return out;
}

function countFiles(node) {
  return (node.files?.length || 0) + (node.dirs || []).reduce((n, d) => n + countFiles(d), 0);
}

/* ------------------------------------------------------------------ Seite */

function page(body, total) {
  const built = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(SITE_TITLE)}</title>
<meta name="description" content="${esc(SITE_SUBTITLE)}">
<style>
  :root{
    --bg:#f4f6fb; --surface:#ffffff; --surface-hi:#eef2f9;
    --text:#1b2430; --soft:#5b6b7e; --line:#dde4ee;
    --accent:#2f6df0; --accent-soft:#e7effd;
    --shadow:0 1px 2px rgba(20,32,54,.06), 0 8px 24px rgba(20,32,54,.06);
    --radius:14px;
  }
  @media (prefers-color-scheme:dark){
    :root:not([data-theme="light"]){
      --bg:#121926; --surface:#1b2534; --surface-hi:#243044;
      --text:#eaf0f6; --soft:#95a6b8; --line:#334357;
      --accent:#7fb2ff; --accent-soft:#22314b;
      --shadow:0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.28);
    }
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{
    margin:0; background:var(--bg); color:var(--text);
    font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  }
  .wrap{max-width:920px; margin:0 auto; padding:clamp(1.25rem,4vw,3rem) clamp(1rem,4vw,2rem) 4rem}
  header{margin-bottom:2rem}
  h1{font-size:clamp(1.5rem,5vw,2.1rem); line-height:1.2; margin:0 0 .35rem}
  .lede{color:var(--soft); margin:0; font-size:1.02rem}

  .group{margin-top:2.25rem}
  .group--l0{border-top:1px solid var(--line); padding-top:1.5rem}
  .group__title{
    display:flex; align-items:baseline; gap:.6rem; flex-wrap:wrap;
    margin:0 0 1rem; font-size:clamp(1.15rem,3.5vw,1.4rem); line-height:1.25;
  }
  h3.group__title{font-size:1.08rem}
  h4.group__title{font-size:1rem; color:var(--soft)}
  .group__count{
    font-size:.75rem; font-weight:600; color:var(--soft);
    background:var(--surface-hi); border:1px solid var(--line);
    border-radius:999px; padding:.05rem .55rem; line-height:1.6;
  }
  .group .group{margin-left:.25rem; padding-left:.9rem; border-left:2px solid var(--line)}

  .cards{list-style:none; margin:0 0 .5rem; padding:0; display:grid; gap:.75rem}
  @media (min-width:620px){ .cards{grid-template-columns:1fr 1fr} }
  .card a{
    display:flex; gap:.85rem; align-items:flex-start;
    padding:.95rem 1rem; height:100%;
    background:var(--surface); border:1px solid var(--line);
    border-radius:var(--radius); box-shadow:var(--shadow);
    text-decoration:none; color:inherit;
    transition:transform .12s ease, border-color .12s ease, box-shadow .12s ease;
  }
  .card a:hover,.card a:focus-visible{
    transform:translateY(-2px); border-color:var(--accent);
    box-shadow:0 2px 4px rgba(20,32,54,.08), 0 14px 32px rgba(20,32,54,.12);
    outline:none;
  }
  .card a:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
  .card__icon{font-size:1.3rem; line-height:1.4; flex:none}
  .card__text{display:flex; flex-direction:column; gap:.15rem; min-width:0}
  .card__title{font-weight:600}
  .card__desc{font-size:.85rem; color:var(--soft)}

  footer{margin-top:3rem; padding-top:1.25rem; border-top:1px solid var(--line); color:var(--soft); font-size:.85rem}

  .empty{color:var(--soft); background:var(--surface); border:1px dashed var(--line); border-radius:var(--radius); padding:1.5rem; text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${esc(SITE_TITLE)}</h1>
    <p class="lede">${esc(SITE_SUBTITLE)}</p>
  </header>
  <main>
${body || '    <p class="empty">Noch keine Materialien im Ordner <code>src/</code>.</p>'}
  </main>
  <footer>
    ${total} ${total === 1 ? "Material" : "Materialien"} · zuletzt aktualisiert am ${built}
  </footer>
</div>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ Kopie */

async function copyTree(node) {
  for (const f of node.files) {
    const dest = join(DIST, relative(SRC, f.path));
    await mkdir(join(dest, ".."), { recursive: true });
    await copyFile(f.path, dest);
  }
  for (const d of node.dirs) await copyTree(d);
}

/* ------------------------------------------------------------------- Main */

async function main() {
  let tree;
  try {
    tree = await readTree(SRC);
  } catch {
    console.error(`Ordner "src/" nicht gefunden.`);
    process.exit(1);
  }

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await copyTree(tree);

  // Dateien, die direkt in src/ liegen (ohne Unterordner), oben anzeigen.
  const rootFiles = tree.files.length ? await renderFiles(tree.files) + "\n" : "";
  const body = rootFiles + (await renderTree(tree, 0));
  const total = countFiles(tree);

  await writeFile(join(DIST, "index.html"), page(body.trimEnd(), total));
  await writeFile(join(DIST, ".nojekyll"), "");

  console.log(`✓ dist/ erstellt – ${total} Datei(en), Index geschrieben.`);
}

main();
