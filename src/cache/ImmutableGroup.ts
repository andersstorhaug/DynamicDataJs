import { IGrouping } from './IGrouping';
import { Cache, ICache } from '../Cache';

export class ImmutableGroup<TObject, TKey, TGroupKey> extends Cache<TObject, TKey> implements IGrouping<TObject, TKey, TGroupKey> {
    constructor(public readonly key: TGroupKey, cache: ICache<TObject, TKey>) {
        super();

        for (let [key, item] of cache.entries()) {
            this.addOrUpdate(item, key);
        }
    }
}
