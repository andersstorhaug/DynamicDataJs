import { Observable, OperatorFunction, tap, switchAll, map, filter } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { ConnectConfig } from '../IConnectableCache';
import { ISourceCache } from '../ISourceCache';
import { ObservableCache } from '../ObservableCache';

type CacheOrObservableChangeSet<TObject, TKey> = ISourceCache<TObject, TKey> | Observable<IChangeSet<TObject, TKey>>;

/**
 * Transforms an observable sequence of observable changes sets into an observable sequence
 * producing values only from the most recent observable sequence.
 * Each time a new inner observable sequence is received, unsubscribe from the
 * previous inner observable sequence and clear the existing result set.
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the destination key.
 * @param connectConfig Configuration used when connecting to a new source.
 */
export function switchCache<TObject, TKey>(connectConfig?: ConnectConfig<TObject>): OperatorFunction<CacheOrObservableChangeSet<TObject, TKey>, IChangeSet<TObject, TKey>> {
    return function (sources: Observable<CacheOrObservableChangeSet<TObject, TKey>>) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const destination = new ObservableCache<TObject, TKey>();

            const populator = sources
                .pipe(
                    map(source => (source instanceof Observable ? source : source.connect(connectConfig))),
                    tap(_ => destination.updateFromIntermediate(updater => updater.clear())),
                    switchAll(),
                )
                .subscribe(changes =>
                    destination.updateFromIntermediate(updater => {
                        return updater.clone(changes);
                    }),
                );

            const subscription = destination
                .connect(connectConfig)
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
