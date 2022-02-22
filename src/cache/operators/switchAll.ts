import { Observable, OperatorFunction, tap, switchAll as _switchAll, map, filter } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { ISourceCache } from '../ISourceCache';
import { ObservableCache } from '../ObservableCache';

type CacheOrObservableChangeSet<TObject, TKey> = ISourceCache<TObject, TKey> | Observable<IChangeSet<TObject, TKey>>;

export interface SwitchOptions {
    /** Use deep equality with the cache */
    deepEqual?: boolean;

    /** By default, empty change sets are not emitted. Set this value to false to emit empty change sets. */
    suppressEmptyChangeSets?: boolean;
}

/**
 * Transforms an observable sequence of observable changes sets into an observable sequence
 * producing values only from the most recent observable sequence.
 * Each time a new inner observable sequence is received, unsubscribe from the
 * previous inner observable sequence and clear the existing result set.
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the destination key.
 * @param options Operation options.
 */
export function switchAll<TObject, TKey>(options?: SwitchOptions): OperatorFunction<CacheOrObservableChangeSet<TObject, TKey>, IChangeSet<TObject, TKey>> {
    return function switchAllOperator(sources: Observable<CacheOrObservableChangeSet<TObject, TKey>>) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const destination = new ObservableCache<TObject, TKey>(options?.deepEqual ?? false);

            const populator = sources
                .pipe(
                    map(source => (source instanceof Observable ? source : source.connect(options))),
                    tap(_ => destination.updateFromIntermediate(updater => updater.clear())),
                    _switchAll(),
                )
                .subscribe(changes =>
                    destination.updateFromIntermediate(updater => {
                        return updater.clone(changes);
                    }),
                );

            const subscription = destination
                .connect(options)
                .pipe(
                    filter((changes, index) => {
                        // The initial empty change set from the destination cache should be filtered in any case
                        return changes.size > 0 || index > 0;
                    }),
                )
                .subscribe(observer);

            return () => {
                destination.dispose();
                populator.unsubscribe();
                subscription.unsubscribe();
            };
        });
    };
}
