import assert from 'node:assert/strict';
import test from 'node:test';

import {
    findRecoverableOpenAIServiceInstanceKeys,
    isPracticeTranslationService,
    resolvePracticeServiceInstance,
} from './service_instances.js';

const configuredDeepSeek = {
    service: 'openai',
    apiProtocol: 'openai-compatible-chat-completions',
    requestPath: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-v4-flash',
    apiKey: 'test-key',
};

test('recovers a configured compatible service missing from the active list', () => {
    const entries = [
        ['translate_service_list', ['google']],
        ['google', {}],
        ['openai@configured', configuredDeepSeek],
    ];

    assert.deepEqual(findRecoverableOpenAIServiceInstanceKeys(entries, ['google']), ['openai@configured']);
});

test('does not duplicate an active service or recover an unfinished empty-key service', () => {
    const entries = [
        ['openai@active', configuredDeepSeek],
        ['openai@unfinished', { ...configuredDeepSeek, apiKey: '' }],
    ];

    assert.deepEqual(findRecoverableOpenAIServiceInstanceKeys(entries, ['openai@active']), []);
});

test('recovers a service authenticated through custom headers', () => {
    const entries = [
        [
            'openai@header-auth',
            {
                ...configuredDeepSeek,
                apiKey: '',
                customHeaders: '{ "api-key": "custom-token" }',
            },
        ],
    ];

    assert.deepEqual(findRecoverableOpenAIServiceInstanceKeys(entries), ['openai@header-auth']);
});

test('identifies only the selected practice service for exclusion from left translation', () => {
    assert.equal(isPracticeTranslationService('openai@deepseek', 'openai@deepseek'), true);
    assert.equal(isPracticeTranslationService('google', 'openai@deepseek'), false);
    assert.equal(isPracticeTranslationService('openai@mimo', ''), false);
});

test('resolves the first configured compatible service before a practice selection is saved', () => {
    assert.equal(
        resolvePracticeServiceInstance('', ['google', 'openai@deepseek'], {
            google: { service: 'google' },
            'openai@deepseek': configuredDeepSeek,
        }),
        'openai@deepseek'
    );
    assert.equal(
        resolvePracticeServiceInstance('openai@mimo', ['openai@deepseek', 'openai@mimo'], {
            'openai@deepseek': configuredDeepSeek,
            'openai@mimo': { ...configuredDeepSeek, model: 'configured-mimo-model' },
        }),
        'openai@mimo'
    );
});
