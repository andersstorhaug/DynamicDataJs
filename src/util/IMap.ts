interface IMap<TKey, TObject> {
    get: (key: TKey) => TObject | undefined;
    set: (key: TKey, value: TObject) => void;
    has: (key: TKey) => boolean;
    delete: (key: TKey) => boolean;
}
