import { Language } from './info';
import { chatCompletions, defaultRequestArguments } from '../../openai_compatible';

export async function translate(text, from, to, options) {
    const { config, setResult, detect } = options;

    let { promptList } = config;

    // 兼容旧版
    if (promptList === undefined) {
        promptList = [
            {
                role: 'system',
                content:
                    'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
            },
            { role: 'user', content: `Translate into $to:\n"""\n$text\n"""` },
        ];
    }

    promptList = promptList.map((item) => {
        return {
            ...item,
            content: item.content
                .replaceAll('$text', text)
                .replaceAll('$from', from)
                .replaceAll('$to', to)
                .replaceAll('$detect', Language[detect]),
        };
    });

    return chatCompletions({
        config: {
            ...config,
            requestArguments: config.requestArguments ?? defaultRequestArguments,
        },
        messages: promptList,
        onUpdate: setResult,
        onStreamFallback: () => setResult?.(''),
    });
}

export * from './Config';
export * from './info';
