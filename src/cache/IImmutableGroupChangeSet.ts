import { IChangeSet } from './IChangeSet';
import { IGrouping } from './IGrouping';

export interface IImmutableGroupChangeSet<TObject, TKey, TGroupKey> extends IChangeSet<IGrouping<TObject, TKey, TGroupKey>, TGroupKey> {}
