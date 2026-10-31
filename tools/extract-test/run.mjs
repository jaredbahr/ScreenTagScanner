#!/usr/bin/env node
/**
 * Accuracy and cost test: run tag photos through one or more Claude models
 * using the exact prompt/schema from apps-script/Extraction.gs, then score the
 * results against hand-typed answers.
 *
 * Usage:
 *   node run.mjs [--photos ../../private/photos] [--truth ../../private/truth.csv]
 *                [--models claude-haiku-5-5,claude-sonnet-5-5,claude-opus-5-5]
 *
 * Photos should already be resized the way the Shortcut will send them
 * (~2000 px long edge, JPEG). On a Mac: sips -Z 2000 -s format jpeg *.HEIC --out resized/
 *
 * Results are written to private/results-<timestamp>.json (gitignored).
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");

// Published per-million-token prices (USD), checked 2026-10. Verify before quoting.
const PRICES = {
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-opus-5-5": { in: 4, out: 20 },
};

// ---- args ----
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const photosDir = path.resolve(args.photos ?? path.join(repo, "private/photos"));
const truthPath = path.resolve(args.truth ?? path.join(repo, "private/truth.csv"));
const models = (args.models ?? Object.keys(PRICES).join(",")).split(",");

// ---- load the shared prompt/schema/helpers from Extraction.gs ----
const gsCode = fs.readFileSync(path.join(repo, "apps-script/Extraction.gs"), "utf8");
const X = vm.runInNewContext(
  gsCode +
    "\n;({ EXTRACTION_VERSION, buildRequest_, parseResponse_, reviewReasons_, formatPhone_, formatInches_ })",
);

// ---- inputs ----
if (!fs.existsSync(photosDir)) {
  console.error(`No photos folder at ${photosDir}. Put resized tag photos there (it's gitignored).`);
  process.exit(1);
}
const photos = fs
  .readdirSync(photosDir)
  .filter((f) => /\.(jpe?g|png)$/i.test(f))
  .sort();
const truth = fs.existsSync(truthPath) ? loadTruth(truthPath) : null;
if (!truth) console.warn(`No truth file at ${truthPath}; reporting raw results without scoring.\n`);

const client = new Anthropic();
const results = [];

for (const model of models) {
  let inTok = 0, outTok = 0;
  const score = {};
  console.log(`\n=== ${model} (prompt ${X.EXTRACTION_VERSION}) ===`);

  for (const file of photos) {
    const buf = fs.readFileSync(path.join(photosDir, file));
    const mediaType = /\.png$/i.test(file) ? "image/png" : "image/jpeg";
    const { body, betas } = X.buildRequest_(model, buf.toString("base64"), mediaType);
    const started = Date.now();
    let row = { model, file };
    try {
      const resp = await client.beta.messages.create({ ...body, betas });
      const x = X.parseResponse_(resp);
      // Cached prompt tokens are billed apart from input_tokens: writes at 1.25x, reads at 0.1x (0.13.34 caching).
      inTok += resp.usage.input_tokens + 1.25 * (resp.usage.cache_creation_input_tokens || 0) + 0.1 * (resp.usage.cache_read_input_tokens || 0);
      outTok += resp.usage.output_tokens;
      row = { ...row, ms: Date.now() - started, usage: resp.usage, extracted: x, review: X.reviewReasons_(x) };

      const t = truth?.get(file);
      if (t) {
        // Score every column the truth file provides, matched to the field of the same name.
        row.checks = {};
        for (const [k, want] of Object.entries(t)) {
          if (k === "file" || want === "") continue;
          row.checks[k] = same(k, x[k], want);
        }
        for (const [k, ok] of Object.entries(row.checks)) {
          score[k] ??= [0, 0];
          score[k][1]++;
          if (ok) score[k][0]++;
        }
      }
      const miss = row.checks ? Object.entries(row.checks).filter(([, ok]) => !ok).map(([k]) => k) : [];
      console.log(
        `${file.padEnd(26)} ${String(x.store).padEnd(14)} #${String(x.ticket_number).padEnd(8)} ${String(x.last_name).padEnd(10)} ${X.formatPhone_(x.phone).padEnd(13)} ` +
          `${X.formatInches_(x.width_in)} x ${X.formatInches_(x.height_in)}`.padEnd(18) +
          (miss.length ? `  ✗ ${miss.join(",")}` : row.checks ? "  ✓" : "") +
          (row.review.length ? `  [review: ${row.review.join("; ")}]` : ""),
      );
    } catch (err) {
      row.error = String(err.message ?? err);
      console.log(`${file.padEnd(24)} ERROR ${row.error}`);
    }
    results.push(row);
  }

  const p = PRICES[model];
  const cost = p ? (inTok * p.in + outTok * p.out) / 1e6 : NaN;
  const n = photos.length || 1;
  console.log(`\nTokens: ${Math.round(inTok)} input-priced in / ${outTok} out  →  $${cost.toFixed(4)} total, $${(cost / n).toFixed(5)} per tag`);
  if (truth) {
    for (const [k, [ok, tot]] of Object.entries(score)) {
      console.log(`  ${k.padEnd(10)} ${ok}/${tot}${tot ? ` (${Math.round((100 * ok) / tot)}%)` : ""}`);
    }
  }
}

fs.mkdirSync(path.join(repo, "private"), { recursive: true });
const out = path.join(repo, "private", `results-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`\nFull results: ${out}`);

// ---- helpers ----
function loadTruth(p) {
  const [header, ...lines] = fs.readFileSync(p, "utf8").trim().split(/\r?\n/);
  const cols = header.split(",").map((c) => c.trim());
  const map = new Map();
  for (const line of lines) {
    const vals = line.split(",").map((v) => v.trim());
    const rec = Object.fromEntries(cols.map((c, i) => [c, vals[i] ?? ""]));
    map.set(rec.file, rec);
  }
  return map;
}
function same(field, got, want) {
  if (field === "phone") return digits(got) === digits(want);
  if (typeof got === "number" || /^-?[\d.]+$/.test(want)) return Number(got) === Number(want);
  return norm(got) === norm(want);
}
function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}
function digits(s) {
  return String(s ?? "").replace(/\D/g, "");
}
