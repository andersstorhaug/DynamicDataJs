import { OperatorFunction } from 'rxjs';
import { map } from 'rxjs/operators';
import { from as ixFrom, toArray as ixToArray } from 'ix/iterable';
import { map as ixMap } from 'ix/iterable/operators';
import { ISortedChangeSet } from '../ISortedChangeSet';

/**
 * Converts the changeset into a fully formed sorted collection. Each change in the source results in a new collection
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export function toSortedCollection<TObject, TKey>(): OperatorFunction<ISortedChangeSet<TObject, TKey>, TObject[]> {
    return function toSortedCollectionOperator(source) {
        return source.pipe(
            map(changeSet => {
                const values = ixFrom(changeSet.sortedItems.values()).pipe(ixMap(keyValue => keyValue[1]));
                return ixToArray(values);
            }),
        );
    };
}
