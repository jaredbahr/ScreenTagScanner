// Offline truth-file parsing and field comparison; importing this module makes no API calls.
const NUMERIC_FIELDS = new Set([
  'panes', 'glass_price', 'width_in', 'height_in', 'billable_inches',
  'tag_index', 'tag_count', 'screens_on_tag',
]);

export function same(field, got, want) {
  if (got == null || want == null || norm(got) === '' || norm(want) === '') return false;
  if (field === 'phone') {
    const actual = digits(got), expected = digits(want);
    return actual.length > 0 && actual === expected;
  }
  if (NUMERIC_FIELDS.has(field)) {
    if (!['string', 'number'].includes(typeof got) || !['string', 'number'].includes(typeof want)) return false;
    const actual = Number(got), expected = Number(want);
    return Number.isFinite(actual) && Number.isFinite(expected) && actual === expected;
  }
  return norm(got) === norm(want);
}

function norm(value) {
  return String(value ?? '').trim().toLowerCase();
}
function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function parseTruthCSV(text) {
  const rows = [], row = [];
  let value = '', quoted = false, closedQuote = false;
  text = text.replace(/^\uFEFF/, '');
  const field = () => { row.push(value.trim()); value = ''; closedQuote = false; };
  const record = () => {
    field();
    if (row.some(cell => cell !== '')) rows.push(row.slice());
    row.length = 0;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { value += '"'; i++; }
        else { quoted = false; closedQuote = true; }
      } else value += char;
    } else if (char === ',') field();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      record();
    } else if (closedQuote) {
      if (!/[ \t]/.test(char)) throw new Error('Unexpected text after a quoted CSV field');
    } else if (char === '"') {
      if (value !== '') throw new Error('Unexpected quote in an unquoted CSV field');
      quoted = true;
    } else value += char;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field');
  if (value !== '' || row.length > 0 || closedQuote) record();
  const [headers, ...records] = rows;
  if (!headers || !headers.includes('file') || headers.some(name => name === '') || new Set(headers).size !== headers.length) {
    throw new Error('Truth CSV needs unique nonempty headers including file');
  }
  const truth = new Map();
  for (const cells of records) {
    if (cells.length !== headers.length) throw new Error('Truth CSV row has a different number of fields than its header');
    const item = Object.fromEntries(headers.map((name, i) => [name, cells[i]]));
    if (!item.file || truth.has(item.file)) throw new Error('Truth CSV needs one nonempty unique file per row');
    truth.set(item.file, item);
  }
  return truth;
}
