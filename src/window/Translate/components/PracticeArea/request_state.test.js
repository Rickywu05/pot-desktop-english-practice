import assert from 'node:assert/strict';
import test from 'node:test';

import { canReusePracticeFeedback, createPracticeRequestKey, isPracticeFeedbackStale } from './request_state.js';

test('reuses feedback when source, user text, and service are unchanged', () => {
    const completedKey = createPracticeRequestKey({
        sourceText: '你好',
        userText: 'hello',
        serviceInstance: 'openai@deepseek',
    });
    const currentKey = createPracticeRequestKey({
        sourceText: ' 你好\r\n',
        userText: 'hello ',
        serviceInstance: 'openai@deepseek',
    });

    assert.equal(completedKey, currentKey);
    assert.equal(canReusePracticeFeedback({ feedback: '检查结果', lastCompletedKey: completedKey, currentKey }), true);
    assert.equal(isPracticeFeedbackStale({ feedback: '检查结果', lastCompletedKey: completedKey, currentKey }), false);
});

test('keeps feedback but marks it stale when either text or service changes', () => {
    const completedKey = createPracticeRequestKey({
        sourceText: '你好',
        userText: 'hello',
        serviceInstance: 'openai@deepseek',
    });
    const changedKeys = [
        createPracticeRequestKey({
            sourceText: '你好吗',
            userText: 'hello',
            serviceInstance: 'openai@deepseek',
        }),
        createPracticeRequestKey({
            sourceText: '你好',
            userText: 'hello there',
            serviceInstance: 'openai@deepseek',
        }),
        createPracticeRequestKey({
            sourceText: '你好',
            userText: 'hello',
            serviceInstance: 'openai@mimo',
        }),
    ];

    for (const currentKey of changedKeys) {
        assert.equal(
            canReusePracticeFeedback({ feedback: '旧结果', lastCompletedKey: completedKey, currentKey }),
            false
        );
        assert.equal(isPracticeFeedbackStale({ feedback: '旧结果', lastCompletedKey: completedKey, currentKey }), true);
    }
});

test('does not report stale or reusable state before a successful check', () => {
    assert.equal(canReusePracticeFeedback({ feedback: '', lastCompletedKey: '', currentKey: 'new' }), false);
    assert.equal(isPracticeFeedbackStale({ feedback: '', lastCompletedKey: '', currentKey: 'new' }), false);
});
