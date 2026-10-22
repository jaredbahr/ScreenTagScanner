# Extraction accuracy & cost test

Runs real tag photos through Claude with the **exact** prompt and schema the production script uses (`apps-script/Extraction.gs`), then scores the answers and reports cost per tag.

## Setup

```bash
cd tools/extract-test
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # "Screen Tags" workspace key
```

## Inputs (kept in `private/`, which is gitignored; never commit customer data)

```
private/
  photos/      tag01.jpg, tag02.jpg, ...  (resized ~2000 px long edge, JPEG)
  truth.csv    what each tag actually says
```

`truth.csv` format (see [`truth.example.csv`](truth.example.csv)); dimensions in decimal inches, phone as digits:

```csv
file,store_number,last_name,phone,width_in,height_in
tag01.jpg,1234,Smith,6305550142,36,48
```

Resize iPhone photos on a Mac: `sips -Z 2000 -s format jpeg *.HEIC --out resized/`

## Run

```bash
node run.mjs                                         # all three models
node run.mjs --models claude-haiku-5-5               # one model
node run.mjs --photos ~/tags --truth ~/tags/truth.csv
```

Output: one line per photo (✓ / ✗ per field, review flags), per-field accuracy, tokens, and **actual cost per tag**. Full JSON goes to `private/results-*.json`.

## Decision rule

Pick the cheapest model that matches the best model's accuracy on name, phone and both dimensions. Set it as `MODEL` in Script Properties.
