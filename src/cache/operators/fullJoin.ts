import { OperatorFunction, Observable, map, merge } from 'rxjs';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { IChangeSet } from '../IChangeSet';
import { asObservableCache } from './asObservableCache';
import { changeKey } from './changeKey';

/**
 * Groups the right data source and joins the resulting group to the left data source, matching these using the specified key selector. Results are included when the left or the right has a value.
 * This is the equivalent of SQL full join.
 * @category Operator
 * @param right The right data source.
 * @param rightKeySelector Specify the foreign key on the right data source.
 * @param resultSelector The result selector used to transform the combined data into.
 * @returns An observable which will emit change sets.
 */
export function fullJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(
    right: Observable<IChangeSet<TRight, TRightKey>>,
    rightKeySelector: (value: TRight) => TLeftKey,
    resultSelector: (leftKey: TLeftKey, left: TLeft | undefined, right: TRight | undefined) => TDestination,
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
                    const leftItem = change.current;
                    const rightItem = rightCache.lookup(change.key);

                    switch (change.reason) {
                        case 'add':
                        case 'update':
                            joinedCache.addOrUpdate(resultSelector(change.key, leftItem, rightItem), change.key);
                            break;

                        case 'remove':
                            if (rightItem === undefined) {
                                // remove from result because there is no left and no rights
                                joinedCache.removeKey(change.key);
                            } else {
                                // update with no left value
                                joinedCache.addOrUpdate(resultSelector(change.key, undefined, rightItem), change.key);
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

        const rightLoader = rightCache.connect().pipe(
            map(changes => {
                for (const change of changes) {
                    const rightItem = change.current;
                    const leftItem = leftCache.lookup(change.key);

                    switch (change.reason) {
                        case 'add':
                        case 'update':
                            joinedCache.addOrUpdate(resultSelector(change.key, leftItem, rightItem), change.key);
                            break;

                        case 'remove':
                            if (leftItem === undefined) {
                                // remove from result because there is no left and no rights
                                joinedCache.removeKey(change.key);
                            } else {
                                // update with no right value
                                joinedCache.addOrUpdate(resultSelector(change.key, leftItem, undefined), change.key);
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
