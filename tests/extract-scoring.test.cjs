'use strict';
// Synthetic offline fixtures only. The paid extraction CLI is never imported.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const { same, parseTruthCSV } = await import(pathToFileURL(path.join(__dirname, '../tools/extract-test/scoring.mjs')));
  let passed = 0;
  function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
  test('null extraction is not a measured zero', () => assert.equal(same('width_in', null, '0'), false));
  test('undefined extraction is not a measured zero', () => assert.equal(same('width_in', undefined, '0'), false));
  test('empty extraction is not a measured zero', () => assert.equal(same('width_in', '', '0'), false));
  test('whitespace extraction is not a measured zero', () => assert.equal(same('width_in', '  ', '0'), false));
  test('actual zero remains a valid measurement', () => assert.equal(same('width_in', 0, '0'), true));
  test('numeric fields compare their values', () => {
    for (const field of ['panes','glass_price','width_in','height_in','billable_inches','tag_index','tag_count','screens_on_tag']) {
      assert.equal(same(field, 36, '36.0'), true, field);
      assert.equal(same(field, 35, '36.0'), false, field);
    }
  });
  test('nonfinite numeric values never score', () => {
    for (const value of [NaN, Infinity, -Infinity, 'Infinity']) assert.equal(same('width_in', value, String(value)), false);
  });
  test('booleans cannot masquerade as numeric zero or one', () => {
    assert.equal(same('panes', false, '0'), false); assert.equal(same('panes', true, '1'), false);
  });
  test('ticket identifiers preserve leading zeros', () => assert.equal(same('ticket_number', '0123456', '123456'), false));
  test('store identifiers preserve leading zeros', () => assert.equal(same('store', '0123', '123'), false));
  test('matching identifier control', () => assert.equal(same('ticket_number', '0123456', '0123456'), true));
  test('phone formatting is ignored', () => assert.equal(same('phone', '(000) 000-0000', '0000000000'), true));
  test('phone digit mismatches fail', () => assert.equal(same('phone', '0000000001', '0000000000'), false));
  test('missing or nondigit phones do not score', () => {
    assert.equal(same('phone', null, '0000000000'), false); assert.equal(same('phone', 'unknown', 'unknown'), false);
  });
  test('text keeps case and surrounding-space normalization', () => assert.equal(same('material', ' Fiberglass ', 'fiberglass'), true));
  test('boolean text remains comparable', () => assert.equal(same('is_tag', true, 'true'), true));
  test('simple CSV stays compatible', () => {
    assert.deepEqual(parseTruthCSV('file,width_in\nfixture.png,36\n').get('fixture.png'), {file:'fixture.png',width_in:'36'});
  });
  test('quoted commas stay in their column', () => {
    assert.deepEqual(parseTruthCSV('file,qty_rows,width_in\r\nfixture.png,"1,2",36\r\n').get('fixture.png'), {file:'fixture.png',qty_rows:'1,2',width_in:'36'});
  });
  test('escaped quotes decode once', () => assert.equal(parseTruthCSV('file,notes\nfixture.png,"a ""quote"""').get('fixture.png').notes, 'a "quote"'));
  test('quoted line breaks remain inside the field', () => assert.equal(parseTruthCSV('file,notes\r\nfixture.png,"first\r\nsecond"\r\n').get('fixture.png').notes, 'first\r\nsecond'));
  test('BOM, blank lines and final empty column work', () => assert.equal(parseTruthCSV('\uFEFFfile,notes\n\nfixture.png,\n').get('fixture.png').notes, ''));
  test('unterminated quote refuses the truth file', () => assert.throws(() => parseTruthCSV('file,notes\nfixture.png,"unfinished'), /Unclosed/));
  test('text after a closing quote refuses the truth file', () => assert.throws(() => parseTruthCSV('file,notes\nfixture.png,"x"junk'), /Unexpected/));
  test('quote inside an unquoted field refuses the truth file', () => assert.throws(() => parseTruthCSV('file,notes\nfixture.png,a"b'), /Unexpected/));
  test('shifted or incomplete records refuse the truth file', () => {
    assert.throws(() => parseTruthCSV('file,notes\nfixture.png,x,extra'), /number of fields/);
    assert.throws(() => parseTruthCSV('file,notes\nfixture.png'), /number of fields/);
  });
  test('missing or duplicate headers refuse the truth file', () => {
    for (const text of ['', 'notes\nx', 'file,notes,notes\nfixture.png,a,b', 'file,\nfixture.png,x']) assert.throws(() => parseTruthCSV(text), /headers/);
  });
  test('missing or duplicate filenames cannot silently replace a case', () => {
    assert.throws(() => parseTruthCSV('file,notes\n,x'), /unique file/);
    assert.throws(() => parseTruthCSV('file,notes\nfixture.png,x\nfixture.png,y'), /unique file/);
  });
  test('the supplied example uses the documented store key', () => {
    const dir = path.join(__dirname, '../tools/extract-test');
    const example = fs.readFileSync(path.join(dir, 'truth.example.csv'), 'utf8');
    const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
    assert.ok(parseTruthCSV(example).get('tag01.jpg').store);
    assert.match(readme, /file,store,last_name,phone,width_in,height_in/);
    assert.doesNotMatch(readme, /store_number/);
  });
  console.log(`${passed} extraction scoring tests passed`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
