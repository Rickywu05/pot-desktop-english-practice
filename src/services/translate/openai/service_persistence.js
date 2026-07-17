import { emit } from '@tauri-apps/api/event';

import { store } from '../../../utils/store';

const TRANSLATE_SERVICE_LIST_KEY = 'translate_service_list';
const PRACTICE_SERVICE_INSTANCE_KEY = 'english_practice_service_instance';

function configEventName(key) {
    return `${key.replaceAll('.', '_').replaceAll('@', ':')}_changed`;
}

export async function persistOpenAIServiceInstance(instanceKey, config) {
    const currentList = (await store.get(TRANSLATE_SERVICE_LIST_KEY)) ?? [];
    const nextList = currentList.includes(instanceKey) ? currentList : [...currentList, instanceKey];
    const currentPracticeServiceInstance = (await store.get(PRACTICE_SERVICE_INSTANCE_KEY)) ?? '';
    const nextPracticeServiceInstance = currentPracticeServiceInstance || instanceKey;

    await store.set(instanceKey, config);
    await store.set(TRANSLATE_SERVICE_LIST_KEY, nextList);
    await store.set(PRACTICE_SERVICE_INSTANCE_KEY, nextPracticeServiceInstance);
    await store.save();

    await emit(configEventName(instanceKey), config);
    await emit(configEventName(TRANSLATE_SERVICE_LIST_KEY), nextList);
    if (!currentPracticeServiceInstance) {
        await emit(configEventName(PRACTICE_SERVICE_INSTANCE_KEY), nextPracticeServiceInstance);
    }
}
