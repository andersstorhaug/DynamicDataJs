import { find } from 'ix/iterable';
import equal from 'fast-deep-equal';

export function deepEqualMapAdapter<K, V>(map: Map<K, V>): IMap<K, V> {
    return {
        get(key) {
            return map.get(key) ?? find(map, { predicate: f => equal(f[0], key) })?.[1];
        },
        set(key, value) {
            const foundKey = find(map, { predicate: ([k]) => equal(k, key) });
            if (foundKey !== undefined) {
                map.delete(foundKey[0]);
            }
            map.set(key, value);
        },
        delete(key) {
            const foundKey = find(map, { predicate: ([k]) => equal(k, key) });
            if (foundKey !== undefined) {
                return map.delete(foundKey[0]);
            } else {
                return map.delete(key);
            }
        },
        has(key) {
            const foundKey = find(map, { predicate: ([k]) => equal(k, key) });
            if (foundKey !== undefined) return true;
            return map.has(key);
        },
    };
}
