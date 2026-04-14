const fs = require('fs');
const p = require('path').join(__dirname, 'utils.js');
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('async function queryGemini(prompt, modelName');
const end = s.indexOf('\n\nasync function queryGeminiImage');
if (start === -1 || end === -1) {
  console.error('markers', start, end);
  process.exit(1);
}
const stub =
  'async function queryGemini(_prompt, _modelName, _attachments = [], _includeSources, _threadHistory = [], _thinkingBudget = 0) {\n' +
  "  log('queryGemini: désactivé (IA Groq uniquement).');\n" +
  '  return null;\n' +
  '}';
s = s.slice(0, start) + stub + s.slice(end);
fs.writeFileSync(p, s);
console.log('ok');
