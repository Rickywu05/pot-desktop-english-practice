function normalizePracticeText(value) {
    return String(value ?? '')
        .replaceAll('\r\n', '\n')
        .trim();
}

export function createPracticeRequestKey({ sourceText, userText, serviceInstance }) {
    return JSON.stringify([
        String(serviceInstance ?? ''),
        normalizePracticeText(sourceText),
        normalizePracticeText(userText),
    ]);
}

export function canReusePracticeFeedback({ feedback, lastCompletedKey, currentKey }) {
    return Boolean(feedback && lastCompletedKey && lastCompletedKey === currentKey);
}

export function isPracticeFeedbackStale({ feedback, lastCompletedKey, currentKey }) {
    return Boolean(feedback && lastCompletedKey && lastCompletedKey !== currentKey);
}
