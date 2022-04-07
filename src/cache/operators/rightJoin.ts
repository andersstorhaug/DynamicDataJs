import { map, merge, OperatorFunction } from 'rxjs';
import { Observable } from 'rxjs';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { IChangeSet } from '../IChangeSet';
import { asObservableCache } from './asObservableCache';
import { groupWithImmutableState } from './groupWithImmutableState';

/**
 * Joins the left and right observable data sources, taking all right values and combining any matching left values.
 * @category Operator
 * @param right The right data source.
 * @param rightKeySelector Specify the foreign key on the right data source.
 * @param resultSelector The result selector used to transform the combined data into.
 * @returns An observable which will emit change sets.
 */
export function rightJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(
    right: Observable<IChangeSet<TRight, TRightKey>>,
    rightKeySelector: (value: TRight) => TLeftKey,
    resultSelector: (key: TRightKey, left: TLeft | undefined, right: TRight) => TDestination,
): OperatorFunction<IChangeSet<TLeft, TLeftKey>, IChangeSet<TDestination, TRightKey>> {
    return left => {
        // create local backing stores
        const leftCache = asObservableCache(left);
        const rightCache = asObservableCache(right);
        const rightGroupedCache = asObservableCache(right.pipe(groupWithImmutableState(rightKeySelector)));

        // joined is the final cache
        const joinedCache = new ChangeAwareCache<TDestination, TRightKey>();

        const rightLoader = rightCache.connect().pipe(
            map(changes => {
                for (const change of changes) {
                    const leftKey = rightKeySelector(change.current);

                    switch (change.reason) {
                        case 'add':
                        case 'update':
                            // Update with right (and left if it is presents)
                            const rightItem = change.current;
                            const leftItem = leftCache.lookup(leftKey);

                            joinedCache.addOrUpdate(resultSelector(change.key, leftItem, rightItem), change.key);
                            break;

                        case 'remove':
                            // remove from result because a right value is expected
                            joinedCache.removeKey(change.key);
                            break;

                        case 'refresh':
                            // propagate upstream
                            joinedCache.refreshKey(change.key);
                            break;
                    }
                }

                return joinedCache.captureChanges();
            }),
        );

        const leftLoader = leftCache.connect().pipe(
            map(changes => {
                for (let change of changes) {
                    const leftItem = change.current;
                    const rightGroup = rightGroupedCache.lookup(change.key);

                    if (rightGroup === undefined) continue;

                    switch (change.reason) {
                        case 'add':
                        case 'update':
                            for (let [rightKey, rightItem] of rightGroup.entries()) {
                                joinedCache.addOrUpdate(resultSelector(rightKey, leftItem, rightItem), rightKey);
                            }
                            break;

                        case 'remove':
                            for (let [rightKey, rightItem] of rightGroup.entries()) {
                                joinedCache.addOrUpdate(resultSelector(rightKey, undefined, rightItem), rightKey);
                            }
                            break;

                        case 'refresh':
                            for (let [rightKey, _rightItem] of rightGroup.entries()) {
                                joinedCache.refreshKey(rightKey);
                            }
                            break;
                    }
                }

                return joinedCache.captureChanges();
            }),
        );

        return new Observable(subscriber => {
            const loader = merge(leftLoader, rightLoader).subscribe(subscriber);

            return () => {
                loader.unsubscribe();
                leftCache.dispose();
                rightCache.dispose();
            };
        });
    };
}
