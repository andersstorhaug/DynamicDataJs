import { map, merge, OperatorFunction } from 'rxjs';
import { Observable } from 'rxjs';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { IChangeSet } from '../IChangeSet';
import { JoinKey } from '../JoinKey';
import { asObservableCache } from './asObservableCache';
import { groupWithImmutableState } from './groupWithImmutableState';

/**
 * Joins the left and right observable data sources, taking values when both left and right values are present.
 * This is the equivalent of SQL inner join.
 * @category Operator
 * @param right The right data source.
 * @param rightKeySelector Specify the foreign key on the right data source.
 * @param resultSelector The result selector used to transform the combined data into.
 * @returns An observable which will emit change sets.
 */
export function innerJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(
    right: Observable<IChangeSet<TRight, TRightKey>>,
    rightKeySelector: (value: TRight) => TLeftKey,
    resultSelector: (key: JoinKey<TLeftKey, TRightKey>, left: TLeft, right: TRight) => TDestination,
): OperatorFunction<IChangeSet<TLeft, TLeftKey>, IChangeSet<TDestination, JoinKey<TLeftKey, TRightKey>>> {
    return left => {
        return new Observable(subscriber => {
            // create local backing stores
            const leftCache = asObservableCache(left);
            const rightCache = asObservableCache(right);
            const rightGrouped = asObservableCache(right.pipe(groupWithImmutableState(rightKeySelector)));

            // joined is the final cache
            const joinedCache = new ChangeAwareCache<TDestination, JoinKey<TLeftKey, TRightKey>>(true);

            const leftLoader = leftCache.connect().pipe(
                map(changes => {
                    for (let change of changes) {
                        const leftItem = change.current;
                        const rightGroup = rightGrouped.lookup(change.key);

                        if (rightGroup !== undefined) {
                            switch (change.reason) {
                                case 'add':
                                case 'update':
                                    for (let keyValue of rightGroup.entries()) {
                                        const key = new JoinKey(change.key, keyValue[0]);
                                        joinedCache.addOrUpdate(resultSelector(key, leftItem, keyValue[1]), key);
                                    }
                                    break;

                                case 'remove':
                                    for (let keyValue of rightGroup.entries()) {
                                        joinedCache.removeKey(new JoinKey(change.key, keyValue[0]));
                                    }
                                    break;

                                case 'refresh':
                                    for (let rightKey of rightGroup.keys()) {
                                        joinedCache.refreshKey(new JoinKey(change.key, rightKey));
                                    }
                                    break;
                            }
                        }
                    }

                    return joinedCache.captureChanges();
                }),
            );

            const rightLoader = rightCache.connect().pipe(
                map(changes => {
                    for (let change of changes) {
                        const leftKey = rightKeySelector(change.current);

                        switch (change.reason) {
                            case 'add':
                            case 'update':
                                // Update with right (and left if it is presents)
                                const rightItem = change.current;
                                const leftItem = leftCache.lookup(leftKey);
                                const key = new JoinKey(leftKey, change.key);

                                if (leftItem !== undefined) {
                                    joinedCache.addOrUpdate(resultSelector(key, leftItem, rightItem), key);
                                } else {
                                    joinedCache.removeKey(key);
                                }

                                if (change.previous) {
                                    const previousKey = new JoinKey(rightKeySelector(change.previous), change.key);

                                    if (key.toString() !== previousKey.toString()) {
                                        joinedCache.removeKey(previousKey);
                                    }
                                }
                                break;

                            case 'remove':
                                // remove from result because a right value is expected
                                joinedCache.removeKey(new JoinKey(leftKey, change.key));
                                break;

                            case 'refresh':
                                joinedCache.refreshKey(new JoinKey(leftKey, change.key));
                                break;
                        }
                    }

                    return joinedCache.captureChanges();
                }),
            );

            const loader = merge(leftLoader, rightLoader).subscribe(subscriber);

            return () => {
                loader.unsubscribe();
                leftCache.dispose();
                rightCache.dispose();
            };
        });
    };
}
