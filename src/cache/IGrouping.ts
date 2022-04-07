export interface IGrouping<TObject, TKey, TGroupKey> {
    size: number;
    key: TGroupKey;
    keys(): IterableIterator<TKey>;
    values(): IterableIterator<TObject>;
    entries(): IterableIterator<[TKey, TObject]>;
    lookup(key: TKey): TObject | undefined;
}
