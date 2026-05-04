const fs = require('fs');
const parser = require('@babel/parser');
const path = process.argv[2];
const lines = Number(process.argv[3]) || null;
if (!path) {
  console.error('Usage: node .tmp-babel-parse.js <file> [lines]');
  process.exit(1);
}
let text = fs.readFileSync(path, 'utf8');
if (lines) {
  text = text.split(/\r?\n/).slice(0, lines).join('\n');
}
try {
  parser.parse(text, {
    sourceType: 'module',
    plugins: ['jsx','optionalChaining','nullishCoalescingOperator','classProperties','objectRestSpread','decorators-legacy'],
  });
  console.log('parsed');
} catch (err) {
  console.error(err.message);
  if (err.loc) console.error('loc', err.loc.line + ':' + err.loc.column);
  process.exit(1);
}
