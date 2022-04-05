import { from, toArray } from 'ix/iterable';
import { skip, take } from 'ix/iterable/operators';
import { filter, map, merge, Observable, OperatorFunction } from 'rxjs';
import { PageRequest } from '../..';
import { FilteredIndexCalculator } from '../FilteredIndexCalculator';
import { IKeyValueCollection } from '../IKeyValueCollection';
import { IPagedChangeSet } from '../IPagedChangeSet';
import { ISortedChangeSet } from '../ISortedChangeSet';
import { KeyValueCollection } from '../KeyValueCollection';
import { PagedChangeSet } from '../PagedChangeSet';
import { PageResponse } from '../PageResponse';

export function page<TObject, TKey>(pageRequests: Observable<PageRequest>): OperatorFunction<ISortedChangeSet<TObject, TKey>, IPagedChangeSet<TObject, TKey>> {
    return function (source) {
        let _all: IKeyValueCollection<TObject, TKey> = new KeyValueCollection<TObject, TKey>();
        let _current: IKeyValueCollection<TObject, TKey> = new KeyValueCollection<TObject, TKey>();
        let _isLoaded = false;
        let _request = PageRequest.empty;

        const requestChanges = pageRequests.pipe(map(page));
        const dataChanges = source.pipe(map(update));

        return new Observable<IPagedChangeSet<TObject, TKey>>(subscriber => {
            return merge(requestChanges, dataChanges)
                .pipe(
                    filter(value => value !== null),
                    map(value => value!),
                )
                .subscribe(subscriber);
        });

        function page(request: PageRequest): IPagedChangeSet<TObject, TKey> | null {
            if (request.page === 0 || request.size < 1) return null;
            if (request.size === _request.size && request.page === _request.page) return null;

            _request = request;

            return paginate();
        }

        function update(updates: ISortedChangeSet<TObject, TKey>) {
            _isLoaded = true;
            _all = updates.sortedItems;

            return paginate(updates);
        }

        function paginate(updates?: ISortedChangeSet<TObject, TKey>): IPagedChangeSet<TObject, TKey> | null {
            if (!_isLoaded) return null;

            const previous = _current;

            const pages = calculatePages();
            const page = _request.page > pages ? pages : _request.page;
            const skipCount = _request.size * (page - 1);

            const paged = toArray(from(_all).pipe(skip(skipCount), take(_request.size)));

            _current = new KeyValueCollection<TObject, TKey>(paged, _all.comparer, updates?.sortedItems?.sortReason ?? 'dataChanged', _all.optimizations);

            // check for changes within the current virtualised page.  Notify if there have been changes or if the overall count has changed
            const notifications = FilteredIndexCalculator.calculate<TObject, TKey>(_current, previous, updates);
            if (notifications.length == 0 && previous.size != _current.size) {
                return null;
            }

            const response = {
                pageSize: _request.size,
                totalSize: _all.size,
                page,
                pages,
            } as PageResponse;

            return new PagedChangeSet<TObject, TKey>(response, _current, notifications);
        }

        function calculatePages() {
            if (_request.size >= _all.size) return 1;

            const pages = _all.size / _request.size;
            const overlap = _all.size % _request.size;
            return overlap === 0 ? pages : pages + 1;
        }
    };
}
