const OPENAI_COMPATIBLE_PROTOCOL = 'openai-compatible-chat-completions';

function hasAuthentication(config) {
    if (config.apiKey?.trim()) return true;
    return /"(?:authorization|api-key)"\s*:/i.test(config.customHeaders ?? '');
}

function isConfiguredOpenAICompatibleService(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return false;

    const compatible = config.apiProtocol === OPENAI_COMPATIBLE_PROTOCOL || config.service === 'openai';
    return Boolean(compatible && config.requestPath?.trim() && config.model?.trim() && hasAuthentication(config));
}

export function findRecoverableOpenAIServiceInstanceKeys(entries, activeInstanceKeys = []) {
    const activeKeys = new Set(activeInstanceKeys);

    return (entries ?? [])
        .filter(([instanceKey, config]) => {
            return !activeKeys.has(instanceKey) && isConfiguredOpenAICompatibleService(config);
        })
        .map(([instanceKey]) => instanceKey);
}
