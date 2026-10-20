import { describe, it, expect } from 'vitest';
import { toLocalStartOfDayIso, toLocalEndOfDayIso } from '../src/api/transfers.js';

describe('transfers.js date helpers', () => {
  it('converts YYYY-MM-DD to local start of day ISO string', () => {
    const iso = toLocalStartOfDayIso('2026-10-20');
    expect(typeof iso).toBe('string');
    // Parsing back as Date should have local hours 00:00:00.000
    const date = new Date(iso);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9); // 0-indexed October
    expect(date.getDate()).toBe(20);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
    expect(date.getMilliseconds()).toBe(0);
  });

  it('converts YYYY-MM-DD to local end of day ISO string', () => {
    const iso = toLocalEndOfDayIso('2026-10-20');
    expect(typeof iso).toBe('string');
    // Parsing back as Date should have local hours 23:59:59.999
    const date = new Date(iso);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(20);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
    expect(date.getSeconds()).toBe(59);
    expect(date.getMilliseconds()).toBe(999);
  });

  it('passes through full ISO strings unchanged', () => {
    const fullIso = '2026-10-20T14:30:00.000Z';
    expect(toLocalStartOfDayIso(fullIso)).toBe(fullIso);
    expect(toLocalEndOfDayIso(fullIso)).toBe(fullIso);
  });

  it('passes through null, undefined, or empty strings unchanged', () => {
    expect(toLocalStartOfDayIso('')).toBe('');
    expect(toLocalStartOfDayIso(null)).toBe(null);
    expect(toLocalStartOfDayIso(undefined)).toBe(undefined);
    expect(toLocalEndOfDayIso('')).toBe('');
    expect(toLocalEndOfDayIso(null)).toBe(null);
    expect(toLocalEndOfDayIso(undefined)).toBe(undefined);
  });
});
