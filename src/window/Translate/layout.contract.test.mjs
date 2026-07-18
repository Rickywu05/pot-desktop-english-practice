import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const translatePagePath = fileURLToPath(new URL('./index.jsx', import.meta.url));
const source = await readFile(translatePagePath, 'utf8');
const literatureAreaPath = fileURLToPath(new URL('./components/LiteratureTranslationArea/index.jsx', import.meta.url));
const literatureSource = await readFile(literatureAreaPath, 'utf8');

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
assert.match(
    source,
    /flex h-full min-h-0 gap-2 overflow-hidden/,
    'The two-column container must constrain overflow while the native window is resized.'
);
assert.doesNotMatch(
    literatureSource,
    /(?:min-w|max-w|w)-\[[0-9]+px\]/,
    'The literature card must not impose a fixed pixel width on the original translation panel.'
);
assert.match(
    literatureSource,
    /max-h-\[40vh\] min-h-\[100px\] overflow-y-auto/,
    'Long literature output must scroll inside the card instead of breaking the window layout.'
);

console.log('Translate practice panels resize responsively and keep the default single-panel layout.');
