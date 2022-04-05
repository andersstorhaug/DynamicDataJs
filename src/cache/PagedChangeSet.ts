import { ArrayOrIterable } from '../util/ArrayOrIterable';
import { Change } from './Change';
import { IKeyValueCollection } from './IKeyValueCollection';
import { IPagedChangeSet } from './IPagedChangeSet';
import { PageResponse } from './PageResponse';
import { SortedChangeSet } from './SortedChangeSet';

export class PagedChangeSet<TObject, TKey> extends SortedChangeSet<TObject, TKey> implements IPagedChangeSet<TObject, TKey> {
    constructor(public readonly response: PageResponse, sortedItems: IKeyValueCollection<TObject, TKey>, collection?: ArrayOrIterable<Change<TObject, TKey>>) {
        super(sortedItems, collection);
    }
}
