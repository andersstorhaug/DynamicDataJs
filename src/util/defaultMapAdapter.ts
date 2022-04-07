import { getPrimitive } from './getPrimitive';

export function defaultMapAdapter<K, V>(map: Map<K, V>): IMap<K, V> {
    return {
        get(key) {
            return map.get(getPrimitive(key));
        },
        set(key, value) {
            return map.set(getPrimitive(key), value);
        },
        delete(key) {
            return map.delete(getPrimitive(key));
        },
        has(key) {
            return map.has(getPrimitive(key));
        },
    };
}
