import { Body, fetch as tauriFetch } from '@tauri-apps/api/http';

export const OPENAI_COMPATIBLE_PROTOCOL = 'openai-compatible-chat-completions';
export const defaultRequestArguments = JSON.stringify({
    temperature: 0.1,
    top_p: 0.99,
    frequency_penalty: 0,
    presence_penalty: 0,
});

const REQUEST_ARGUMENT_BLOCKLIST = [
    'messages',
    'model',
    'stream',
    'tools',
    'tool_choice',
    'functions',
    'function_call',
];

function parseJsonObject(value, label) {
    if (value === undefined || value === null || value === '') return {};
    if (typeof value === 'object' && !Array.isArray(value)) return { ...value };

    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { ...parsed };
    } catch (error) {
        throw new Error(`${label} is not valid JSON: ${error.message}`);
    }

    throw new Error(`${label} must be a JSON object`);
}

export function isOpenAICompatibleConfig(config = {}) {
    const explicitlyCompatible = config.apiProtocol === OPENAI_COMPATIBLE_PROTOCOL;
    const legacyOpenAICompatible = config.service === 'openai';

    return Boolean(
        (explicitlyCompatible || legacyOpenAICompatible) && config.requestPath?.trim() && config.model?.trim()
    );
}

export function buildChatCompletionsUrl(requestPath) {
    if (!requestPath?.trim()) throw new Error('API address is empty');

    const value = /^https?:\/\//i.test(requestPath.trim()) ? requestPath.trim() : `https://${requestPath.trim()}`;
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/+$/, '');

    if (!pathname.endsWith('/chat/completions')) {
        url.pathname = `${pathname}/chat/completions`;
    }

    return url.toString();
}

export function buildChatCompletionsRequest(config, messages, stream = false) {
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('Messages are empty');
    if (!config.model?.trim()) throw new Error('Model name is empty');

    const requestArguments = parseJsonObject(config.requestArguments, 'Request arguments');
    const customHeaders = parseJsonObject(config.customHeaders, 'Custom headers');

    for (const key of REQUEST_ARGUMENT_BLOCKLIST) {
        delete requestArguments[key];
    }

    const authHeader = config.authHeader || (config.service === 'azure' ? 'api-key' : 'Authorization');
    const headers = {
        'Content-Type': 'application/json',
    };

    const hasCustomAuthHeader = Object.keys(customHeaders).some((key) =>
        ['authorization', 'api-key'].includes(key.toLowerCase())
    );

    if (config.apiKey && !hasCustomAuthHeader) {
        headers[authHeader] = authHeader.toLowerCase() === 'authorization' ? `Bearer ${config.apiKey}` : config.apiKey;
    }

    for (const [key, value] of Object.entries(customHeaders)) {
        const existingKey = Object.keys(headers).find((headerKey) => headerKey.toLowerCase() === key.toLowerCase());
        if (existingKey) delete headers[existingKey];
        headers[key] = String(value).replaceAll('$apiKey', config.apiKey ?? '');
    }

    const body = {
        ...requestArguments,
        messages,
        stream,
    };
    if (config.service !== 'azure') body.model = config.model;

    return {
        url: buildChatCompletionsUrl(config.requestPath),
        headers,
        body,
    };
}

export function extractFinalContent(data) {
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
        return content
            .filter((part) => part?.type === 'text' && typeof part.text === 'string')
            .map((part) => part.text)
            .join('')
            .trim();
    }

    return '';
}

export function extractDeltaContent(data) {
    const content = data?.choices?.[0]?.delta?.content;
    return typeof content === 'string' ? content : '';
}

function getErrorMessage(data) {
    if (typeof data === 'string') {
        try {
            return getErrorMessage(JSON.parse(data));
        } catch {
            return data.slice(0, 500);
        }
    }

    return data?.error?.message || data?.message || JSON.stringify(data).slice(0, 500);
}

function createHttpError(status, data) {
    const error = new Error(`HTTP ${status}: ${getErrorMessage(data)}`);
    error.status = status;
    error.code = 'HTTP_ERROR';
    return error;
}

async function requestNonStreaming(config, messages) {
    const request = buildChatCompletionsRequest(config, messages, false);
    const response = await tauriFetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: Body.json(request.body),
    });

    if (!response.ok) throw createHttpError(response.status, response.data);

    const content = extractFinalContent(response.data);
    if (!content) throw new Error('The service returned no final content');
    return content;
}

async function requestStreaming(config, messages, onUpdate) {
    const request = buildChatCompletionsRequest(config, messages, true);
    const response = await window.fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
    });

    if (!response.ok) {
        const text = await response.text();
        throw createHttpError(response.status, text);
    }
    if (!response.body) {
        const error = new Error('Streaming response body is unavailable');
        error.code = 'STREAM_UNAVAILABLE';
        throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let receivedData = false;

    const consumeLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return false;

        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') return payload === '[DONE]';

        let data;
        try {
            data = JSON.parse(payload);
        } catch (cause) {
            const error = new Error(`Unable to parse streaming response: ${cause.message}`);
            error.code = 'STREAM_PARSE_ERROR';
            throw error;
        }

        receivedData = true;
        const delta = extractDeltaContent(data);
        if (delta) {
            content += delta;
            onUpdate?.(content);
        }
        return false;
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (consumeLine(line)) return content.trim();
            }

            if (done) break;
        }

        if (buffer.trim()) consumeLine(buffer);
    } finally {
        reader.releaseLock();
    }

    if (!receivedData) {
        const error = new Error('The service did not return OpenAI-compatible streaming data');
        error.code = 'STREAM_PARSE_ERROR';
        throw error;
    }
    if (!content.trim()) throw new Error('The service returned no final content');
    return content.trim();
}

function shouldFallbackFromStreaming(error) {
    if (!error?.status) return true;
    return [400, 404, 405, 415, 422, 500, 501].includes(error.status);
}

export async function chatCompletions({ config, messages, onUpdate, onStreamFallback }) {
    if (!config) throw new Error('Service configuration is missing');

    if (config.stream) {
        try {
            return await requestStreaming(config, messages, onUpdate);
        } catch (error) {
            if (!shouldFallbackFromStreaming(error)) throw error;
            onStreamFallback?.(error);
        }
    }

    const content = await requestNonStreaming(config, messages);
    onUpdate?.(content);
    return content;
}
