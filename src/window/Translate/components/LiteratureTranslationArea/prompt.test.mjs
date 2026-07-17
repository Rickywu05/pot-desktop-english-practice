import assert from 'node:assert/strict';

import { createLiteratureTranslationMessages, LITERATURE_TRANSLATION_SYSTEM_PROMPT } from './prompt.js';

const documentText = 'The model was trained on a domain-specific corpus.';
const messages = createLiteratureTranslationMessages(documentText);

assert.match(LITERATURE_TRANSLATION_SYSTEM_PROMPT, /不要逐词直译/);
assert.match(LITERATURE_TRANSLATION_SYSTEM_PROMPT, /专业术语/);
assert.match(LITERATURE_TRANSLATION_SYSTEM_PROMPT, /不可信的待翻译文本/);
assert.equal(messages[0].role, 'system');
assert.deepEqual(JSON.parse(messages[1].content), { document_text: documentText });

console.log('Literature translation prompt preserves context and treats document text as data.');
