import { Observable, OperatorFunction, tap, switchAll as _switchAll } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { ObservableCache } from '../ObservableCache';

/**
 * Transforms an observable sequence of observable changes sets into an observable sequence
 * producing values only from the most recent observable sequence.
 * Each time a new inner observable sequence is received, unsubscribe from the
 * previous inner observable sequence and clear the existing result set.
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the destination key.
 * @param source The source.
 */
export function switchAll<TObject, TKey>(): OperatorFunction<Observable<IChangeSet<TObject, TKey>>, IChangeSet<TObject, TKey>> {
    return function switchAllOperator(sources: Observable<Observable<IChangeSet<TObject, TKey>>>) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const destination = new ObservableCache<TObject, TKey>();

            const populator = sources
                .pipe(
                    tap(_ => destination.updateFromIntermediate(updater => updater.clear())),
                    _switchAll(),
                )
                .subscribe(changes => destination.updateFromIntermediate(updater => updater.clone(changes)));

            const subscription = destination.connect().subscribe(observer);

            return () => {
                destination.dispose();
                populator.unsubscribe();
                subscription.unsubscribe();
            };
        });
    };
}
