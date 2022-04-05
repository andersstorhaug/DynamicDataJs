import { findIndex, from, toArray } from 'ix/iterable';
import { map, union, except, intersect, filter, orderByDescending } from 'ix/iterable/operators';
import { Change } from './Change';
import { IChangeSet } from './IChangeSet';
import { IKeyValueCollection } from './IKeyValueCollection';
import { ChangeSet } from './ChangeSet';
import bs from 'binary-search';
import { KeyValueComparer } from './Comparer';

export type KeyComparer<TObject, TKey> = (a: readonly [TKey, TObject], b: readonly [TKey, TObject]) => boolean;

export class FilteredIndexCalculator {
    static calculate<TObject, TKey>(
        currentItems: IKeyValueCollection<TObject, TKey>,
        previousItems: IKeyValueCollection<TObject, TKey>,
        sourceUpdates?: IChangeSet<TObject, TKey>,
    ) {
        sourceUpdates ??= ChangeSet.empty<TObject, TKey>();

        if (currentItems.sortReason === 'comparerChanged' || currentItems.sortReason === 'initialLoad') {
            // clear collection and rebuild
            const removed = from(previousItems).pipe(
                map(([key, current], currentIndex) =>
                    Change.create<TObject, TKey>({
                        reason: 'remove',
                        key,
                        current,
                        currentIndex,
                    }),
                ),
            );

            const newItems = from(currentItems).pipe(
                map(([key, current], currentIndex) =>
                    Change.create({
                        reason: 'add',
                        key,
                        current,
                        currentIndex,
                    }),
                ),
            );

            return toArray(removed.pipe(union(newItems)));
        }

        const previousList = toArray(previousItems);

        const keyComparer: KeyComparer<TObject, TKey> = (a, b) => {
            return a[0] != null && b[0] != null && a[0] === b[0];
        };

        const removes = from(previousItems).pipe(except(currentItems, keyComparer));
        const adds = from(currentItems).pipe(except(previousItems, keyComparer));

        const inBothKeys = toArray(
            from(previousItems).pipe(
                intersect(currentItems, keyComparer),
                map(([key, _]) => key),
            ),
        );

        const result: Change<TObject, TKey>[] = [];

        for (let remove of removes) {
            const index = previousList.findIndex(previous => keyComparer(previous, remove));

            previousList.splice(index, 1);

            result.push(
                Change.create<TObject, TKey>({
                    reason: 'remove',
                    key: remove[0],
                    current: remove[1],
                    currentIndex: index,
                }),
            );
        }

        for (let add of adds) {
            const index = bs(previousList, add, currentItems.comparer);
            const insertIndex = ~index;

            previousList.splice(insertIndex, 0, add);

            result.push(
                Change.create<TObject, TKey>({
                    reason: 'add',
                    key: add[0],
                    current: add[1],
                    currentIndex: insertIndex,
                }),
            );
        }

        // Adds and removes have been accounted for
        // so check whether anything in the remaining change set have been moved ot updated

        const remainingItems = toArray(
            from(sourceUpdates).pipe(
                filter(change => {
                    switch (change.reason) {
                        case 'update':
                        case 'moved':
                        case 'refresh':
                            return inBothKeys.find(key => key === change.key) !== undefined;
                        default:
                            return false;
                    }
                }),
            ),
        );

        for (let change of remainingItems) {
            if (change.reason === 'update') {
                let current: [TKey, TObject] = [change.key, change.current];
                let previous: [TKey, TObject] = [change.key, change.previous!];

                // remove from the actual index
                let removeIndex = previousList.findIndex(value => keyComparer(value, previous));
                previousList.splice(removeIndex, 1);

                // insert into the desired index
                let desiredIndex = bs(previousList, current, currentItems.comparer);
                let insertIndex = ~desiredIndex;
                previousList.splice(insertIndex, 0, current);

                result.push(
                    Change.create<TObject, TKey>({
                        reason: 'update',
                        key: current[0],
                        current: current[1],
                        previous: previous[1],
                        currentIndex: insertIndex,
                        previousIndex: removeIndex,
                    }),
                );
            } else if (change.reason === 'moved') {
                let current: [TKey, TObject] = [change.key, change.current];

                let previousIndex = previousList.findIndex(value => keyComparer(value, current));
                let desiredIndex = findIndex(currentItems, {
                    predicate: value => keyComparer(value, current),
                });

                if (previousIndex == desiredIndex) continue;

                if (desiredIndex < 0) throw new Error('Cannot determine current index');

                previousList.splice(previousIndex, 1);
                previousList.splice(desiredIndex, 0, current);

                result.push(
                    Change.create<TObject, TKey>({
                        reason: 'moved',
                        key: current[0],
                        current: current[1],
                        currentIndex: desiredIndex,
                        previousIndex: previousIndex,
                    }),
                );
            } else {
                result.push(change);
            }

            const evaluates = from(remainingItems).pipe(
                filter(change => change.reason === 'refresh'),
                orderByDescending(value => [change.key, change.current] as const, currentItems.comparer),
            );

            for (let u of evaluates) {
                let current: [TKey, TObject] = [change.key, change.current];
                let old = previousList.findIndex(value => keyComparer(value, current));

                if (old === -1) continue;

                let newPosition = FilteredIndexCalculator.getInsertPositionLinear(previousList, current, currentItems.comparer);

                if (old < newPosition) newPosition--;
                if (old === newPosition) continue;

                previousList.splice(old, 1);
                previousList.splice(newPosition, 0, current);
                result.push(
                    Change.create<TObject, TKey>({
                        reason: 'moved',
                        key: u.key,
                        current: u.current,
                        currentIndex: newPosition,
                        previousIndex: old,
                    }),
                );
            }
        }

        return result;
    }

    private static getInsertPositionLinear<TObject, TKey>(list: [TKey, TObject][], item: [TKey, TObject], comparer: KeyValueComparer<TObject, TKey>) {
        for (var i = 0; i < list.length; i++) {
            if (comparer(item, list[i]) < 0) {
                return i;
            }
        }

        return list.length;
    }
}
