const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'reborn-test-bot', 'src');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && p.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);

// Patterns to strip ephemeral usage. Order matters.
const REPLACES = [
  // Bitwise combos with MessageFlags.Ephemeral.
  [/MessageFlags\.IsComponentsV2\s*\|\s*MessageFlags\.Ephemeral/g, 'MessageFlags.IsComponentsV2'],
  [/MessageFlags\.Ephemeral\s*\|\s*MessageFlags\.IsComponentsV2/g, 'MessageFlags.IsComponentsV2'],
  [/([\w.]+\.flags)\s*\|\s*MessageFlags\.Ephemeral/g, '$1'],
  [/MessageFlags\.Ephemeral\s*\|\s*([\w.]+\.flags)/g, '$1'],

  // Standalone `flags: MessageFlags.Ephemeral`.
  [/(\s*)flags:\s*MessageFlags\.Ephemeral\s*,/g, '$1'],
  [/,\s*flags:\s*MessageFlags\.Ephemeral(?=\s*[)}])/g, ''],
  [/flags:\s*MessageFlags\.Ephemeral\s*/g, ''],

  // `ephemeral: true` (legacy option).
  [/(\s*)ephemeral:\s*true\s*,/g, '$1'],
  [/,\s*ephemeral:\s*true(?=\s*[)}])/g, ''],
  [/\bephemeral:\s*true\s*/g, ''],
];

let totalChanged = 0;
for (const f of files) {
  const original = fs.readFileSync(f, 'utf8');
  let s = original;
  for (const [re, rep] of REPLACES) s = s.replace(re, rep);
  if (s !== original) {
    fs.writeFileSync(f, s);
    totalChanged++;
    console.log('updated', path.relative(__dirname, f));
  }
}
console.log(`\n${totalChanged} files updated.`);
