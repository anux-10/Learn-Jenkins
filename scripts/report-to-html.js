#!/usr/bin/env node
'use strict';

// Minimal Markdown -> HTML converter for the CI/CD report.
// Supports: headings, paragraphs, bold, inline code, links, images, lists,
// tables, fenced code blocks, blockquotes and horizontal rules.
// Images are embedded as base64 so the HTML/PDF is self-contained.

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const inputPath = process.argv[2] || path.join(root, 'CI-CD-REPORT.md');
const outputPath = process.argv[3] || path.join(root, 'CI-CD-REPORT.html');

const source = fs.readFileSync(inputPath, 'utf8');
const lines = source.split(/\r?\n/);

const escapeHtml = (text) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const mimeFor = (file) => {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
};

const inline = (text) => {
  let out = escapeHtml(text);
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    const file = path.resolve(root, src);
    if (!fs.existsSync(file)) return `<em>[missing image: ${escapeHtml(src)}]</em>`;
    const data = fs.readFileSync(file).toString('base64');
    return `<img alt="${alt}" src="data:${mimeFor(file)};base64,${data}">`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return out;
};

const html = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];

  if (/^```/.test(line)) {
    const lang = line.slice(3).trim();
    const code = [];
    i += 1;
    while (i < lines.length && !/^```/.test(lines[i])) {
      code.push(lines[i]);
      i += 1;
    }
    i += 1;
    html.push(`<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code.join('\n'))}</code></pre>`);
    continue;
  }

  const heading = line.match(/^(#{1,6})\s+(.*)$/);
  if (heading) {
    const level = heading[1].length;
    html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    i += 1;
    continue;
  }

  if (/^---+$/.test(line.trim())) {
    html.push('<hr>');
    i += 1;
    continue;
  }

  if (/^>\s?/.test(line)) {
    const quote = [];
    while (i < lines.length && /^>\s?/.test(lines[i])) {
      quote.push(lines[i].replace(/^>\s?/, ''));
      i += 1;
    }
    html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
    continue;
  }

  if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1])) {
    const header = line.split('|').slice(1, -1).map((c) => c.trim());
    i += 2;
    const rows = [];
    while (i < lines.length && /^\|/.test(lines[i])) {
      rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
      i += 1;
    }
    html.push('<table><thead><tr>');
    html.push(header.map((c) => `<th>${inline(c)}</th>`).join(''));
    html.push('</tr></thead><tbody>');
    for (const row of rows) {
      html.push('<tr>' + row.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
    }
    html.push('</tbody></table>');
    continue;
  }

  if (/^\s*[-*]\s+/.test(line)) {
    const items = [];
    while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
      items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
      i += 1;
    }
    html.push('<ul>' + items.map((item) => `<li>${inline(item)}</li>`).join('') + '</ul>');
    continue;
  }

  if (/^\s*\d+\.\s+/.test(line)) {
    const items = [];
    while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
      items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
      i += 1;
    }
    html.push('<ol>' + items.map((item) => `<li>${inline(item)}</li>`).join('') + '</ol>');
    continue;
  }

  if (line.trim() === '') {
    i += 1;
    continue;
  }

  const paragraph = [];
  while (
    i < lines.length &&
    lines[i].trim() !== '' &&
    !/^```/.test(lines[i]) &&
    !/^#{1,6}\s/.test(lines[i]) &&
    !/^\|/.test(lines[i]) &&
    !/^\s*[-*]\s+/.test(lines[i]) &&
    !/^\s*\d+\.\s+/.test(lines[i]) &&
    !/^>/.test(lines[i]) &&
    !/^---+$/.test(lines[i].trim())
  ) {
    paragraph.push(lines[i]);
    i += 1;
  }
  html.push(`<p>${inline(paragraph.join(' '))}</p>`);
}

const document = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CI/CD Report — Learn-Jenkins</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1f2933;
    line-height: 1.6;
    margin: 0 auto;
    max-width: 900px;
    padding: 40px 48px;
    font-size: 12pt;
  }
  h1 { font-size: 26pt; margin: 0 0 4px; color: #0b3d91; }
  h2 { font-size: 16pt; margin-top: 28px; border-bottom: 2px solid #dbe4f0; padding-bottom: 4px; color: #0b3d91; }
  h3 { font-size: 13pt; margin-top: 20px; }
  p { margin: 10px 0; }
  a { color: #0b5cad; text-decoration: none; }
  code {
    font-family: "Cascadia Code", Consolas, "Courier New", monospace;
    background: #f0f4f9;
    border: 1px solid #dbe4f0;
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 10.5pt;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    border-radius: 8px;
    padding: 14px 16px;
    overflow-x: auto;
    font-size: 9.5pt;
    line-height: 1.45;
    page-break-inside: avoid;
  }
  pre code { background: none; border: none; color: inherit; padding: 0; font-size: inherit; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 11pt; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; vertical-align: top; }
  th { background: #eef3fa; }
  tr:nth-child(even) td { background: #f8fafc; }
  img {
    max-width: 100%;
    display: block;
    margin: 14px auto;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    page-break-inside: avoid;
  }
  blockquote { border-left: 4px solid #0b5cad; margin: 12px 0; padding: 4px 14px; background: #f4f8fd; }
  ul, ol { margin: 10px 0; padding-left: 24px; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px solid #dbe4f0; margin: 24px 0; }
  @page { size: A4; margin: 16mm 14mm; }
  @media print {
    body { padding: 0; max-width: none; }
    h2 { page-break-after: avoid; }
  }
</style>
</head>
<body>
${html.join('\n')}
</body>
</html>
`;

fs.writeFileSync(outputPath, document, 'utf8');
console.log(`Wrote ${outputPath}`);
