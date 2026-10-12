// WCAG 2.x contrast ratios for the token pairs we actually use. Run: node scripts/contrast.mjs
const hex = (h) =>
  h
    .replace('#', '')
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255);
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h) => {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const pairs = process.argv.slice(2).length
  ? [process.argv.slice(2)]
  : [
      ['#1e1433', '#fff6ea', 'ink on paper'],
      ['#544a6b', '#fff6ea', 'ink-soft on paper'],
      ['#544a6b', '#ffffff', 'ink-soft on surface'],
      ['#544a6b', '#ffe0bd', 'ink-soft on peach gradient top'],
      ['#544a6b', '#ffd2e1', 'ink-soft on peach gradient bottom'],
      ['#ffffff', '#ff4d2e', 'white on tomato'],
      ['#1e1433', '#ff4d2e', 'ink on tomato'],
      ['#ffffff', '#e5361a', 'white on tomato-600'],
      ['#ffffff', '#d4321a', 'white on tomato-700'],
      ['#1e1433', '#ffc23d', 'ink on sun'],
      ['#ffffff', '#1e1433', 'white on ink'],
      ['#fff6ea', '#1e1433', 'paper on ink'],
      ['#c9bfe0', '#1e1433', 'muted on ink band'],
      ['#ffc23d', '#1e1433', 'sun on ink band'],
      ['#c4381c', '#fff6ea', 'tomato-link on paper'],
      ['#1e1433', '#d9f7e8', 'ink on mint tint'],
    ];

for (const [a, b, label = ''] of pairs) {
  const r = ratio(a, b);
  console.log(
    `${r.toFixed(2).padStart(6)}  ${r >= 4.5 ? 'AA ' : r >= 3 ? 'AA-large' : 'FAIL'}  ${a} on ${b}  ${label}`,
  );
}
