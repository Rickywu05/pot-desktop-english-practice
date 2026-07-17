function normalizeText(value) {
    return String(value ?? '')
        .replaceAll('\r\n', '\n')
        .trim();
}

export function createLiteratureTranslationRequestKey({ documentText, serviceInstance }) {
    return JSON.stringify([String(serviceInstance ?? ''), normalizeText(documentText)]);
}

export function canReuseLiteratureTranslation({ translation, lastCompletedKey, currentKey }) {
    return Boolean(translation && lastCompletedKey && lastCompletedKey === currentKey);
}

export function isLiteratureTranslationStale({ translation, lastCompletedKey, currentKey }) {
    return Boolean(translation && lastCompletedKey && lastCompletedKey !== currentKey);
}
