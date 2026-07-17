const jsonArguments = (value) => JSON.stringify(value, null, 2);

export const DEFAULT_OPENAI_PROVIDER_PRESET = 'deepseek';

export const OPENAI_PROVIDER_PRESETS = {
    glm: {
        name: 'GLM',
        requestPath: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        model: 'glm-5.2',
        requestArguments: jsonArguments({ temperature: 0.3 }),
        customHeaders: '{}',
    },
    kimi: {
        name: 'Kimi',
        requestPath: 'https://api.moonshot.cn/v1/chat/completions',
        model: 'kimi-k2.6',
        requestArguments: jsonArguments({ temperature: 0.3 }),
        customHeaders: '{}',
    },
    minimax: {
        name: 'MiniMax',
        requestPath: 'https://api.minimaxi.com/v1/chat/completions',
        model: 'MiniMax-M2.7',
        requestArguments: jsonArguments({ temperature: 0.3, reasoning_split: true }),
        customHeaders: '{}',
    },
    deepseek: {
        name: 'DeepSeek',
        requestPath: 'https://api.deepseek.com/chat/completions',
        model: 'deepseek-v4-flash',
        requestArguments: jsonArguments({ temperature: 0.3, thinking: { type: 'disabled' } }),
        customHeaders: '{}',
    },
    mimo: {
        name: 'MiMo',
        requestPath: 'https://api.xiaomimimo.com/v1/chat/completions',
        model: 'mimo-v2.5-pro',
        requestArguments: jsonArguments({
            temperature: 0.3,
            top_p: 0.95,
            thinking: { type: 'disabled' },
        }),
        customHeaders: '{}',
    },
};

export function inferOpenAIProviderPreset(config = {}) {
    if (config.providerPreset === 'custom') return 'custom';
    if (OPENAI_PROVIDER_PRESETS[config.providerPreset]) return config.providerPreset;

    const requestPath = config.requestPath?.trim().replace(/\/+$/, '').toLowerCase();
    const matchingPreset = Object.entries(OPENAI_PROVIDER_PRESETS).find(
        ([, preset]) => preset.requestPath.toLowerCase() === requestPath
    );

    return matchingPreset?.[0] ?? 'custom';
}
