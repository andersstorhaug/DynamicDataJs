/* eslint-disable unicorn/prevent-abbreviations */
import { Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { IObservableCache } from '../IObservableCache';
import { asObservableCache } from './asObservableCache';
import { IDisposable } from '../../util';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';
import { ConnectOptions } from '../IConnectableCache';

export interface RefCountOptions {
    /** Use deep equality with the cache */
    deepEqual?: boolean;

    /** By default, empty change sets are not emitted. Set this value to false to emit empty change sets. */
    suppressEmptyChangeSets?: boolean;
}

/**
 * Cache equivalent to Publish().RefCount().  The source is cached so long as there is at least 1 subscriber.
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the destination key.
 * @param deepEqual Use deep equality with the cache
 * @param suppressEmptyChangeSets By default, empty change sets are not emitted. Set this value to false to emit empty change sets.
 */
export function refCount<TObject, TKey>(options?: RefCountOptions): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function referenceCountOperator(source: Observable<IChangeSet<TObject, TKey>>) {
        let _referenceCount = 0;
        let _cache: IObservableCache<TObject, TKey>;
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            if (++_referenceCount === 1) {
                _cache = asObservableCache(source, options?.deepEqual);
            }

            const subscriber = _cache.connect(options).subscribe(observer);

            return () => {
                subscriber.unsubscribe();
                let cacheToDispose: IDisposable | undefined;
                if (--_referenceCount == 0) {
                    cacheToDispose = _cache;
                    _cache = undefined!;
                }

                cacheToDispose?.dispose();
            };
        });
    };
}
