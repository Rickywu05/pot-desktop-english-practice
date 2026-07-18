import assert from 'node:assert/strict';
import test from 'node:test';

import {
    canReuseLiteratureTranslation,
    createLiteratureTranslationRequestKey,
    isLiteratureTranslationStale,
} from './request_state.js';

test('normalizes line endings and surrounding whitespace in the request key', () => {
    const windowsKey = createLiteratureTranslationRequestKey({
        documentText: '  first line\r\nsecond line  ',
        serviceInstance: 'deepseek@literature',
    });
    const unixKey = createLiteratureTranslationRequestKey({
        documentText: 'first line\nsecond line',
        serviceInstance: 'deepseek@literature',
    });

    assert.equal(windowsKey, unixKey);
});

test('reuses a completed translation only for the same text and service', () => {
    const key = createLiteratureTranslationRequestKey({
        documentText: 'A domain-specific corpus was used.',
        serviceInstance: 'mimo@literature',
    });

    assert.equal(
        canReuseLiteratureTranslation({
            translation: '使用了特定领域语料库。',
            lastCompletedKey: key,
            currentKey: key,
        }),
        true
    );
    assert.equal(canReuseLiteratureTranslation({ translation: '', lastCompletedKey: key, currentKey: key }), false);
});

test('keeps the previous translation visible but marks it stale after source or service changes', () => {
    const completedKey = createLiteratureTranslationRequestKey({
        documentText: 'Original text',
        serviceInstance: 'deepseek@literature',
    });
    const changedKey = createLiteratureTranslationRequestKey({
        documentText: 'Changed text',
        serviceInstance: 'deepseek@literature',
    });

    assert.equal(
        isLiteratureTranslationStale({
            translation: '原译文',
            lastCompletedKey: completedKey,
            currentKey: changedKey,
        }),
        true
    );
});
