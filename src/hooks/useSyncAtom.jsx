import { useAtom } from 'jotai';

import { useGetState } from './useGetState';

export const useSyncAtom = (atom) => {
    const [atomValue, setAtomValue] = useAtom(atom);
    const [localValue, setLocalValue, getLocalValue] = useGetState(atomValue);

    const syncAtom = (value = getLocalValue()) => setAtomValue(value);

    return [localValue, setLocalValue, syncAtom];
};
