import { ChangeAwareCache } from '../ChangeAwareCache';
import { Cache } from '../Cache';
import { IChangeSet } from '../IChangeSet';
import { ChangeSet } from '../ChangeSet';

export function refreshFilteredFrom<TObject, TKey>(
    filtered: ChangeAwareCache<TObject, TKey>,
    allData: Cache<TObject, TKey>,
    predicate: (value: TObject) => boolean): IChangeSet<TObject, TKey> {
    if (allData.size == 0) {
        return ChangeSet.empty<TObject, TKey>();
    }

    for (var [key, value] of allData.entries()) {
        var exisiting = filtered.lookup(key);
        var matches = predicate(value);

        if (matches) {
            if (!exisiting) {
                filtered.add(value, key);
            }
        } else {
            if (exisiting) {
                filtered.remove(key);
            }
        }
    }

    return filtered.captureChanges();
}