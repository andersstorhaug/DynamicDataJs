import { concatMap, Observable, ReplaySubject, share, ShareConfig } from 'rxjs';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';
import { IChangeSet } from '../IChangeSet';
import { ConnectConfig } from '../IConnectableCache';
import { IObservableCache } from '../IObservableCache';
import { asObservableCache } from './asObservableCache';

export type ShareCacheConfig<TObject, TKey> = Pick<ShareConfig<IObservableCache<TObject, TKey>>, 'resetOnRefCountZero'>;

/**
 * Cache equivalent to `share`.
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the destination key.
 * @param shareConfig Configuration used for underlying `share` operator.
 * @param connectConfig Configuration used when connecting to a new source.
 */
export function shareCache<TObject, TKey>(shareConfig?: ShareCacheConfig<TObject, TKey>, connectConfig?: ConnectConfig<TObject>): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function (source: Observable<IChangeSet<TObject, TKey>>) {
        const _shareConfig: ShareConfig<IObservableCache<TObject, TKey>> = {
            connector: () => new ReplaySubject<IObservableCache<TObject, TKey>>(1),
            ...shareConfig,
        };

        const cache$ = new Observable<IObservableCache<TObject, TKey>>(subscriber => {
            const cache = asObservableCache(source);
            subscriber.next(cache);

            return () => cache.dispose();
        });

        return cache$.pipe(
            share(_shareConfig),
            concatMap(cache => cache.connect(connectConfig)),
        );
    };
}
