import { useCallback, useEffect } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { useGetState } from './useGetState';
import { store } from '../utils/store';
import { debounce } from '../utils';

export const useConfig = (key, defaultValue, options = {}) => {
    const [property, setPropertyState, getProperty] = useGetState(null);
    const { sync = true } = options;

    const persistToStore = useCallback(
        async (v) => {
            await store.set(key, v);
            await store.save();
            const eventKey = key.replaceAll('.', '_').replaceAll('@', ':');
            await emit(`${eventKey}_changed`, v);
        },
        [key]
    );

    // 同步到Store (State -> Store)
    const syncToStore = useCallback(
        debounce((v) => void persistToStore(v)),
        [persistToStore]
    );

    // 同步到State (Store -> State)
    const syncToState = useCallback((v) => {
        if (v !== null) {
            setPropertyState(v);
        } else {
            store.get(key).then((v) => {
                if (v === null) {
                    setPropertyState(defaultValue);
                    store.set(key, defaultValue);
                    store.save();
                } else {
                    setPropertyState(v);
                }
            });
        }
    }, []);

    const setProperty = useCallback(
        (v, forceSync = false) => {
            setPropertyState(v);
            if (forceSync) return persistToStore(v);
            if (sync) syncToStore(v);
            return undefined;
        },
        [persistToStore, setPropertyState, sync, syncToStore]
    );

    // 初始化
    useEffect(() => {
        syncToState(null);
        const eventKey = key.replaceAll('.', '_').replaceAll('@', ':');
        const unlisten = listen(`${eventKey}_changed`, (e) => {
            syncToState(e.payload);
        });
        return () => {
            unlisten.then((f) => {
                f();
            });
        };
    }, []);

    return [property, setProperty, getProperty];
};

export const deleteKey = (key) => {
    if (store.has(key)) {
        store.delete(key);
        store.save();
    }
};
