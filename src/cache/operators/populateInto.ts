import { Observable, Subscription } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { IIntermediateCache } from '../IIntermediateCache';
import { ISourceCache } from '../ISourceCache';

/**
 * Populates a source into the specified cache.
 * @template TObject The type of the object.
 * @template TKey The type of the key.
 * @param source The source.
 * @param destination The destination.
 * @returns A subscription which will unsubscribe from the source.
 */
export function populateInto<TObject, TKey>(
    source: Observable<IChangeSet<TObject, TKey>>,
    destination: ISourceCache<TObject, TKey> | IIntermediateCache<TObject, TKey>,
): Subscription {
    return source.subscribe(changes => destination.edit(updater => updater.clone(changes)));
}
