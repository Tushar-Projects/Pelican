/**
 * WCAG 2.1 Contrast Ratio Checker for Pelican Design Tokens
 * 
 * Implements standard relative luminance:
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * where C_linear = C <= 0.04045 ? C / 12.92 : ((C + 0.055) / 1.055) ^ 2.4
 * Contrast ratio = (L1 + 0.05) / (L2 + 0.05)
 */

function hexToRgb(hex) {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function parseColor(str, bgForAlpha = null) {
  str = str.trim();
  if (str.startsWith('#')) {
    return hexToRgb(str);
  }
  const rgbaMatch = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    if (a < 1 && bgForAlpha) {
      const bgRgb = parseColor(bgForAlpha);
      return {
        r: Math.round(r * a + bgRgb.r * (1 - a)),
        g: Math.round(g * a + bgRgb.g * (1 - a)),
        b: Math.round(b * a + bgRgb.b * (1 - a)),
      };
    }
    return { r, g, b };
  }
  throw new Error(`Unsupported color format: ${str}`);
}

function relativeLuminance(rgb) {
  const [rs, gs, bs] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((c) => {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(colorA, colorB, bgA = null, bgB = null) {
  const rgbA = parseColor(colorA, bgA);
  const rgbB = parseColor(colorB, bgB);
  const l1 = relativeLuminance(rgbA);
  const l2 = relativeLuminance(rgbB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Color palettes
const PALETTE = {
  light: {
    bgPage: '#FAFAF9',
    bgSurface: '#FFFFFF',
    bgInset: '#F5F5F4',
    border: '#E7E5E4',
    borderEmphasis: '#D6D3D1',
    borderInput: '#8A847E', // >= 3:1 against surface & page
    text1: '#1C1917',
    text2: '#57534E',
    text3: '#68625D', // >= 4.5:1 on page, surface and inset
    accent: '#C2410C',
    accentHover: '#9A3412',
    accentText: '#FFFFFF',
    accentSubtle: 'rgba(194, 65, 12, 0.08)',
    ok: '#166534', // green-800
    okBg: '#DCFCE7', // green-100
    warn: '#854D0E', // yellow-800
    warnBg: '#FEF9C3', // yellow-100
    bad: '#B91C1C', // red-700
    badBg: '#FEE2E2', // red-100
    badButton: '#B91C1C',
    badButtonHover: '#991B1B',
    badButtonText: '#FFFFFF',
  },
  dark: {
    bgPage: '#1C1917',
    bgSurface: '#292524',
    bgInset: '#44403C',
    border: '#44403C',
    borderEmphasis: '#57534E',
    borderInput: '#78716C', // >= 3:1 against surface & page
    text1: '#FAFAF9',
    text2: '#D6D3D1',
    text3: '#B8B2AD', // >= 4.5:1 on page, surface and inset
    accent: '#FB923C',
    accentHover: '#F97316',
    accentText: '#1C1917',
    accentSubtle: 'rgba(251, 146, 60, 0.10)',
    ok: '#86EFAC', // green-300
    okBg: '#143823', // dark green tint
    warn: '#FDE047', // yellow-300
    warnBg: '#3B3314', // dark yellow tint
    bad: '#FCA5A5', // red-300
    badBg: '#3E1C1C', // dark red tint
    badButton: '#F87171',
    badButtonHover: '#EF4444',
    badButtonText: '#1C1917',
  },
};

const CHECKS = [
  // LIGHT THEME - TEXT PAIRS (min 4.5:1)
  { theme: 'light', type: 'text', name: 'Text 1 on Surface', fg: PALETTE.light.text1, bg: PALETTE.light.bgSurface },
  { theme: 'light', type: 'text', name: 'Text 1 on Page', fg: PALETTE.light.text1, bg: PALETTE.light.bgPage },
  { theme: 'light', type: 'text', name: 'Text 1 on Inset', fg: PALETTE.light.text1, bg: PALETTE.light.bgInset },
  { theme: 'light', type: 'text', name: 'Text 2 on Surface', fg: PALETTE.light.text2, bg: PALETTE.light.bgSurface },
  { theme: 'light', type: 'text', name: 'Text 2 on Page', fg: PALETTE.light.text2, bg: PALETTE.light.bgPage },
  { theme: 'light', type: 'text', name: 'Text 2 on Inset', fg: PALETTE.light.text2, bg: PALETTE.light.bgInset },
  { theme: 'light', type: 'text', name: 'Text 3 on Surface (inputs/modals)', fg: PALETTE.light.text3, bg: PALETTE.light.bgSurface },
  { theme: 'light', type: 'text', name: 'Text 3 on Page', fg: PALETTE.light.text3, bg: PALETTE.light.bgPage },
  { theme: 'light', type: 'text', name: 'Text 3 on Inset (recessed inputs/headers)', fg: PALETTE.light.text3, bg: PALETTE.light.bgInset },
  { theme: 'light', type: 'text', name: 'Accent on Surface', fg: PALETTE.light.accent, bg: PALETTE.light.bgSurface },
  { theme: 'light', type: 'text', name: 'Accent on Page', fg: PALETTE.light.accent, bg: PALETTE.light.bgPage },
  { theme: 'light', type: 'text', name: 'Accent on Inset', fg: PALETTE.light.accent, bg: PALETTE.light.bgInset },
  { theme: 'light', type: 'text', name: 'Accent Button Text on Accent', fg: PALETTE.light.accentText, bg: PALETTE.light.accent },
  { theme: 'light', type: 'text', name: 'OK Text on OK Badge Bg', fg: PALETTE.light.ok, bg: PALETTE.light.okBg },
  { theme: 'light', type: 'text', name: 'Warn Text on Warn Badge Bg', fg: PALETTE.light.warn, bg: PALETTE.light.warnBg },
  { theme: 'light', type: 'text', name: 'Bad Text on Bad Badge Bg', fg: PALETTE.light.bad, bg: PALETTE.light.badBg },
  { theme: 'light', type: 'text', name: 'Danger Button Text on Bad Button', fg: PALETTE.light.badButtonText, bg: PALETTE.light.badButton },

  // LIGHT THEME - UI CONTROLS & BORDERS (min 3.0:1)
  { theme: 'light', type: 'ui', name: 'Input Border on Surface', fg: PALETTE.light.borderInput, bg: PALETTE.light.bgSurface },
  { theme: 'light', type: 'ui', name: 'Input Border on Page', fg: PALETTE.light.borderInput, bg: PALETTE.light.bgPage },

  // DARK THEME - TEXT PAIRS (min 4.5:1)
  { theme: 'dark', type: 'text', name: 'Text 1 on Surface', fg: PALETTE.dark.text1, bg: PALETTE.dark.bgSurface },
  { theme: 'dark', type: 'text', name: 'Text 1 on Page', fg: PALETTE.dark.text1, bg: PALETTE.dark.bgPage },
  { theme: 'dark', type: 'text', name: 'Text 1 on Inset', fg: PALETTE.dark.text1, bg: PALETTE.dark.bgInset },
  { theme: 'dark', type: 'text', name: 'Text 2 on Surface', fg: PALETTE.dark.text2, bg: PALETTE.dark.bgSurface },
  { theme: 'dark', type: 'text', name: 'Text 2 on Page', fg: PALETTE.dark.text2, bg: PALETTE.dark.bgPage },
  { theme: 'dark', type: 'text', name: 'Text 2 on Inset', fg: PALETTE.dark.text2, bg: PALETTE.dark.bgInset },
  { theme: 'dark', type: 'text', name: 'Text 3 on Surface (inputs/modals)', fg: PALETTE.dark.text3, bg: PALETTE.dark.bgSurface },
  { theme: 'dark', type: 'text', name: 'Text 3 on Page', fg: PALETTE.dark.text3, bg: PALETTE.dark.bgPage },
  { theme: 'dark', type: 'text', name: 'Text 3 on Inset (recessed inputs/headers)', fg: PALETTE.dark.text3, bg: PALETTE.dark.bgInset },
  { theme: 'dark', type: 'text', name: 'Accent on Surface', fg: PALETTE.dark.accent, bg: PALETTE.dark.bgSurface },
  { theme: 'dark', type: 'text', name: 'Accent on Page', fg: PALETTE.dark.accent, bg: PALETTE.dark.bgPage },
  { theme: 'dark', type: 'text', name: 'Accent on Inset', fg: PALETTE.dark.accent, bg: PALETTE.dark.bgInset },
  { theme: 'dark', type: 'text', name: 'Accent Button Text on Accent', fg: PALETTE.dark.accentText, bg: PALETTE.dark.accent },
  { theme: 'dark', type: 'text', name: 'OK Text on OK Badge Bg', fg: PALETTE.dark.ok, bg: PALETTE.dark.okBg },
  { theme: 'dark', type: 'text', name: 'Warn Text on Warn Badge Bg', fg: PALETTE.dark.warn, bg: PALETTE.dark.warnBg },
  { theme: 'dark', type: 'text', name: 'Bad Text on Bad Badge Bg', fg: PALETTE.dark.bad, bg: PALETTE.dark.badBg },
  { theme: 'dark', type: 'text', name: 'Danger Button Text on Bad Button', fg: PALETTE.dark.badButtonText, bg: PALETTE.dark.badButton },

  // DARK THEME - UI CONTROLS & BORDERS (min 3.0:1)
  { theme: 'dark', type: 'ui', name: 'Input Border on Surface', fg: PALETTE.dark.borderInput, bg: PALETTE.dark.bgSurface },
  { theme: 'dark', type: 'ui', name: 'Input Border on Page', fg: PALETTE.dark.borderInput, bg: PALETTE.dark.bgPage },
];

console.log('========================================================================');
console.log(' Pelican Design System — WCAG 2.1 Contrast Ratio Verification');
console.log('========================================================================\n');

let failedCount = 0;
const results = [];

for (const check of CHECKS) {
  const minRequired = check.type === 'text' ? 4.5 : 3.0;
  const ratio = contrastRatio(check.fg, check.bg);
  const pass = ratio >= minRequired;
  if (!pass) failedCount++;

  results.push({
    theme: check.theme,
    type: check.type,
    name: check.name,
    fg: check.fg,
    bg: check.bg,
    ratio: ratio.toFixed(2),
    minRequired: `${minRequired.toFixed(1)}:1`,
    pass,
  });
}

// Print formatted tables
console.log('--- Light Theme ---');
console.log('| Name | FG | BG | Ratio | Target | Status |');
console.log('|---|---|---|---|---|---|');
for (const r of results.filter(r => r.theme === 'light')) {
  console.log(`| ${r.name} | \`${r.fg}\` | \`${r.bg}\` | ${r.ratio}:1 | ${r.minRequired} | ${r.pass ? 'PASS' : 'FAIL'} |`);
}

console.log('\n--- Dark Theme ---');
console.log('| Name | FG | BG | Ratio | Target | Status |');
console.log('|---|---|---|---|---|---|');
for (const r of results.filter(r => r.theme === 'dark')) {
  console.log(`| ${r.name} | \`${r.fg}\` | \`${r.bg}\` | ${r.ratio}:1 | ${r.minRequired} | ${r.pass ? 'PASS' : 'FAIL'} |`);
}

console.log('\n========================================================================');
if (failedCount > 0) {
  console.error(`FAIL: ${failedCount} contrast check(s) did not meet WCAG AA requirements.`);
  process.exit(1);
} else {
  console.log(`SUCCESS: All ${results.length} contrast checks passed WCAG AA requirements.`);
  process.exit(0);
}
