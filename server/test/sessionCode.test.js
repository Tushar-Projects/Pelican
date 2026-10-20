import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSessionCode, SESSION_CODE_ALPHABET } from '../src/models/Session.js';

test('Session code generator', async (t) => {
  await t.test('generates a 6-character code by default', () => {
    const code = generateSessionCode();
    assert.equal(typeof code, 'string');
    assert.equal(code.length, 6);
  });

  await t.test('supports custom lengths', () => {
    assert.equal(generateSessionCode(4).length, 4);
    assert.equal(generateSessionCode(8).length, 8);
    assert.equal(generateSessionCode(12).length, 12);
  });

  await t.test('contains only characters from the allowed alphabet over 5,000 runs', () => {
    const forbiddenChars = new Set(['0', 'O', '1', 'I']);
    const allowedSet = new Set(SESSION_CODE_ALPHABET);

    for (let i = 0; i < 5000; i++) {
      const code = generateSessionCode(6);
      assert.equal(code.length, 6, `Expected code length 6 on iteration ${i}`);

      for (const char of code) {
        assert.ok(
          allowedSet.has(char),
          `Character '${char}' in code '${code}' is not in the allowed alphabet`
        );
        assert.ok(
          !forbiddenChars.has(char),
          `Code '${code}' contains forbidden character '${char}'`
        );
      }
    }
  });

  await t.test('demonstrates character entropy across multiple generations', () => {
    const seenChars = new Set();
    const codes = new Set();

    for (let i = 0; i < 500; i++) {
      const code = generateSessionCode(6);
      codes.add(code);
      for (const char of code) {
        seenChars.add(char);
      }
    }

    // Almost all allowed characters should be sampled over 500 runs (3000 chars)
    assert.ok(
      seenChars.size >= 25,
      `Expected high character coverage across alphabet, got ${seenChars.size} unique characters`
    );
    // Uniqueness over 500 random codes (birthday paradox means rare duplicates, but mostly unique)
    assert.ok(codes.size > 480, `Expected mostly unique codes, got ${codes.size}`);
  });
});
