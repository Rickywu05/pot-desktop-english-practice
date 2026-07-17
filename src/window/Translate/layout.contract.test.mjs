import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const translatePagePath = fileURLToPath(new URL('./index.jsx', import.meta.url));
const source = await readFile(translatePagePath, 'utf8');

assert.doesNotMatch(
    source,
    /normalTranslatePanelWidth/,
    'Practice mode must not lock either panel to the width captured when it was opened.'
);
assert.doesNotMatch(
    source,
    /showPracticeArea/,
    'Practice mode must not hide the right panel when the user resizes the window.'
);
assert.match(
    source,
    /practiceVisible \? 'flex-1 basis-0' : 'w-full'/,
    'The translation panel must grow and shrink with the window while practice mode is open.'
);
assert.match(
    source,
    /practiceVisible\s*\?\s*'h-full min-w-0 flex-1 basis-0 overflow-hidden'\s*:\s*'hidden'/,
    'The practice panel must grow and shrink with the window while it remains visible.'
);

console.log('Translate practice panels resize responsively and keep the default single-panel layout.');
