const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../../evolvefit-polish.css'), 'utf8');
const palette = css.slice(css.indexOf('/* Color language v3'));
assert.ok(palette.length > 4000, 'paleta semântica presente');
const root = palette.match(/:root\s*\{([^}]+)\}/)?.[1];
const dark = palette.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1];
assert.ok(root && dark, 'tokens para ambos os temas');
const read = (block, key) => {
  const match = block.match(new RegExp(`--${key}:\\s*(#[A-Fa-f0-9]{6})\\s*;`));
  assert.ok(match, `token ${key} explícito`);
  return match[1];
};
const luminance = hex => {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
for (const [theme, tokens] of [['claro', root], ['escuro', dark]]) {
  const text = read(tokens, 'text'), muted = read(tokens, 'muted');
  for (const surface of ['surface', 'surface2']) {
    for (const [label, color] of [['principal', text], ['secundário', muted]]) {
      const value = contrast(color, read(tokens, surface));
      assert.ok(value >= 4.5, `${theme}: texto ${label} sobre ${surface} (${value.toFixed(2)}:1)`);
    }
  }
  for (const kind of ['info', 'success', 'warning', 'danger']) {
    const value = contrast(read(tokens, `ef-${kind}`), read(tokens, `ef-${kind}-bg`));
    assert.ok(value >= 4.5, `${theme}: ${kind} legível (${value.toFixed(2)}:1)`);
    assert.ok(contrast(text, read(tokens, `ef-${kind}-bg`)) >= 4.5, `${theme}: frase sobre ${kind}`);
  }
  for (const fill of ['ef-action', 'ef-navy', 'ef-navy-2', 'water', 'ef-success-fill', 'ef-danger-fill']) {
    assert.ok(contrast('#FFFFFF', read(tokens, fill)) >= 4.5, `${theme}: branco em ${fill}`);
  }
}
for (const cls of ['coach27-alert-positive', 'coach27-alert-negative', 'coach27-alert-neutral', 'log-rec-box.up', 'log-rec-box.warn', 'log-rec-box.down', 'evf-home-progress-message.positive', 'evf-home-progress-message.caution', 'training-completion-btn.pending']) {
  assert.ok(palette.includes(cls), `estado visual ${cls}`);
}
assert.ok(palette.includes('border-left: 3px solid var(--ef-warning)'), 'o check-in distingue-se pela faixa lateral');
console.log('Contraste WCAG AA: texto secundário, alertas e ações em ambos os temas.');
