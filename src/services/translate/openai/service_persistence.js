import { emit } from '@tauri-apps/api/event';

import { store } from '../../../utils/store';

const TRANSLATE_SERVICE_LIST_KEY = 'translate_service_list';

function configEventName(key) {
    return `${key.replaceAll('.', '_').replaceAll('@', ':')}_changed`;
}

export async function persistOpenAIServiceInstance(instanceKey, config) {
    const currentList = (await store.get(TRANSLATE_SERVICE_LIST_KEY)) ?? [];
    const nextList = currentList.includes(instanceKey) ? currentList : [...currentList, instanceKey];

    await store.set(instanceKey, config);
    await store.set(TRANSLATE_SERVICE_LIST_KEY, nextList);
    await store.save();

    await emit(configEventName(instanceKey), config);
    await emit(configEventName(TRANSLATE_SERVICE_LIST_KEY), nextList);
}
