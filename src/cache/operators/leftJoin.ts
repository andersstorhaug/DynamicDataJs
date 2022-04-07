import { map, merge, OperatorFunction } from 'rxjs';
import { Observable } from 'rxjs';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { IChangeSet } from '../IChangeSet';
import { asObservableCache } from './asObservableCache';
import { changeKey } from './changeKey';

/**
 * Joins the left and right observable data sources, taking all left values and combining any matching right values.
 * @category Operator
 * @param right The right data source.
 * @param rightKeySelector Specify the foreign key on the right data source.
 * @param resultSelector The result selector used to transform the combined data into.
 * @returns An observable which will emit change sets.
 */
export function leftJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(
    right: Observable<IChangeSet<TRight, TRightKey>>,
    rightKeySelector: (value: TRight) => TLeftKey,
    resultSelector: (key: TLeftKey, left: TLeft, right?: TRight) => TDestination,
): OperatorFunction<IChangeSet<TLeft, TLeftKey>, IChangeSet<TDestination, TLeftKey>> {
    return left => {
        // create local backing stores
        const leftCache = asObservableCache(left);
        const rightCache = asObservableCache(right.pipe(changeKey(rightKeySelector)));

        // joined is the final cache
        const joinedCache = new ChangeAwareCache<TDestination, TLeftKey>();

        const leftLoader = leftCache.connect().pipe(
            map(changes => {
                for (let change of changes) {
                    switch (change.reason) {
                        case 'add':
                        case 'update':
                            // Update with left (and right if it is presents)
                            const leftItem = change.current;
                            const rightItem = rightCache.lookup(change.key);
                            joinedCache.addOrUpdate(resultSelector(change.key, leftItem, rightItem), change.key);
                            break;

                        case 'remove':
                            // remove from result because a left value is expected
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

        const rightLoader = rightCache.connect().pipe(
            map(changes => {
                for (const change of changes) {
                    const rightItem = change.current;
                    const leftItem = leftCache.lookup(change.key);

                    switch (change.reason) {
                        case 'add':
                        case 'update':
                            if (leftItem !== undefined) {
                                // Update with left and right value
                                joinedCache.addOrUpdate(resultSelector(change.key, leftItem, rightItem), change.key);
                            } else {
                                // remove if it is already in the cache
                                joinedCache.removeKey(change.key);
                            }
                            break;

                        case 'remove':
                            if (leftItem !== undefined) {
                                // update with no right value
                                joinedCache.addOrUpdate(resultSelector(change.key, leftItem, undefined), change.key);
                            } else {
                                // remove from result because there is no left and no rights
                                joinedCache.removeKey(change.key);
                            }
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

        return new Observable<IChangeSet<TDestination, TLeftKey>>(subscriber => {
            const loader = merge(leftLoader, rightLoader).subscribe(subscriber);

            return () => {
                loader.unsubscribe();
                leftCache.dispose();
                rightCache.dispose();
            };
        });
    };
}
