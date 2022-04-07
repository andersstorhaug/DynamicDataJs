import { ArrayOrIterable } from '../util/ArrayOrIterable';
import { Change } from './Change';
import { ChangeSet } from './ChangeSet';
import { IGrouping } from './IGrouping';
import { IImmutableGroupChangeSet } from './IImmutableGroupChangeSet';

export class ImmutableGroupChangeSet<TObject, TKey, TGroupKey>
    extends ChangeSet<IGrouping<TObject, TKey, TGroupKey>, TGroupKey>
    implements IImmutableGroupChangeSet<TObject, TKey, TGroupKey>
{
    constructor(items: ArrayOrIterable<Change<IGrouping<TObject, TKey, TGroupKey>, TGroupKey>>) {
        super(items);
    }
}
