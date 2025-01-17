import { concat, defer, isObservable, Observable, of, Subject } from 'rxjs';
import { IChangeSet } from './IChangeSet';
import { CompositeDisposable, Disposable, IDisposable, Lazy } from '../util';
import { ReaderWriter } from './ReaderWriter';
import { distinctUntilChanged, finalize, startWith, tap } from 'rxjs/operators';
import { ICacheUpdater } from './ICacheUpdater';
import { ChangeSet } from './ChangeSet';
import { ISourceUpdater } from './ISourceUpdater';
import { Change } from './Change';
import { filter } from './operators/filter';
import { notEmpty } from './operators/notEmpty';
import { IObservableCache } from './IObservableCache';
import { ConnectConfig } from '..';

export class ObservableCache<TObject, TKey> implements IObservableCache<TObject, TKey> {
    private readonly _changes = new Subject<IChangeSet<TObject, TKey>>();
    private readonly _changesPreview = new Subject<IChangeSet<TObject, TKey>>();
    private readonly _countChanged = new Lazy<Subject<number>>(() => new Subject<number>());
    private readonly _readerWriter: ReaderWriter<TObject, TKey>;
    private readonly _cleanUp = new CompositeDisposable();
    private _editLevel = 0; // The level of recursion in editing.
    private _keySelector?: (object: TObject) => TKey;

    constructor(keySelector?: (object: TObject) => TKey, deepEqual?: boolean);
    constructor(source?: Observable<IChangeSet<TObject, TKey>>, deepEqual?: boolean);
    constructor(deepEqual: boolean);
    constructor();
    constructor(sourceOrKeySelector?: Observable<IChangeSet<TObject, TKey>> | ((object: TObject) => TKey) | boolean, deepEqual = false) {
        if (typeof sourceOrKeySelector === 'boolean') {
            deepEqual = sourceOrKeySelector;
            sourceOrKeySelector = undefined;
        }

        if (isObservable(sourceOrKeySelector)) {
            this._readerWriter = new ReaderWriter<TObject, TKey>(deepEqual);

            const loader = sourceOrKeySelector!
                .pipe(
                    finalize(() => {
                        this._changes.complete();
                        this._changesPreview.complete();
                    }),
                )
                .subscribe(
                    changeset => {
                        const previewHandler = this._changesPreview.observers.length > 0 ? this.invokePreview.bind(this) : undefined;
                        const changes = this._readerWriter.write(changeset, previewHandler, !!this._changes.observers.length);
                        this.invokeNext(changes);
                    },
                    ex => {
                        this._changesPreview.error(ex);
                        this._changes.error(ex);
                    },
                );

            this._cleanUp.add(loader);
        } else {
            this._keySelector = sourceOrKeySelector;
            this._readerWriter = new ReaderWriter<TObject, TKey>(sourceOrKeySelector, deepEqual);
        }

        this._cleanUp.add(
            Disposable.create(() => {
                this._changes.complete();
                this._changesPreview.complete();
                if (this._countChanged.isValueCreated) {
                    this._countChanged.value!.complete();
                }
            }),
        );
    }

    [Symbol.iterator](): IterableIterator<[TKey, TObject]> {
        return this.entries();
    }

    /**
     * @internal
     */
    public updateFromIntermediate(updateAction: (updater: ICacheUpdater<TObject, TKey>) => void) {
        let changes: ChangeSet<TObject, TKey> | null = null;

        this._editLevel++;
        if (this._editLevel === 1) {
            const previewHandler = this._changesPreview.observers.length > 0 ? this.invokePreview.bind(this) : undefined;
            changes = this._readerWriter.write(updateAction, previewHandler, !!this._changes.observers.length);
        } else {
            this._readerWriter.writeNested(updateAction);
        }

        this._editLevel--;

        if (this._editLevel === 0) {
            this.invokeNext(changes!);
        }
    }

    /**
     * @internal
     */
    updateFromSource(updateAction: (updater: ISourceUpdater<TObject, TKey>) => void) {
        let changes: ChangeSet<TObject, TKey> | null = null;

        this._editLevel++;
        if (this._editLevel === 1) {
            const previewHandler = this._changesPreview.observers.length > 0 ? this.invokePreview.bind(this) : undefined;
            changes = this._readerWriter.write(updateAction, previewHandler, !!this._changes.observers.length);
        } else {
            this._readerWriter.writeNested(updateAction);
        }

        this._editLevel--;

        if (this._editLevel === 0) {
            this.invokeNext(changes!);
        }
    }

    private invokePreview(changes: ChangeSet<TObject, TKey>) {
        this._changesPreview.next(changes);
    }

    private invokeNext(changes: ChangeSet<TObject, TKey>) {
        this._changes.next(changes);

        if (this._countChanged.isValueCreated) {
            this._countChanged.value!.next(this._readerWriter.size);
        }
    }

    public get countChanged() {
        return this._countChanged.value!.pipe(startWith(this._readerWriter.size), distinctUntilChanged());
    }

    public watch(key: TKey) {
        return new Observable<Change<TObject, TKey>>(observer => {
            const initial = this._readerWriter.lookup(key);
            if (initial) {
                observer.next(Change.add(key, initial));
            }

            return this._changes.pipe(finalize(() => observer.complete())).subscribe(changes => {
                for (const change of changes) {
                    if (change.key === key) {
                        observer.next(change);
                    }
                }
            });
        });
    }

    public connect(config?: ConnectConfig<TObject>): Observable<IChangeSet<TObject, TKey>> {
        const _config = {
            suppressEmptyChangeSets: true,
            ...config,
        };

        return defer<Observable<IChangeSet<TObject, TKey>>>(() => {
            const initial = of(this.getInitialUpdates(_config.predicate));
            const changes = concat(initial, this._changes.asObservable());

            let result = _config.predicate ? changes.pipe(filter(_config.predicate)) : changes;

            if (_config.suppressEmptyChangeSets) result = result.pipe(notEmpty());

            return result;
        });
    }

    public preview(predicate?: (value: TObject) => boolean): Observable<IChangeSet<TObject, TKey>> {
        return predicate ? this._changesPreview.pipe(filter(predicate), notEmpty()) : this._changesPreview;
    }

    /**
     * @internal
     */
    getInitialUpdates(filter?: (value: TObject) => boolean) {
        return this._readerWriter.getInitialUpdates(filter);
    }

    public get size() {
        return this._readerWriter.size;
    }

    public entries() {
        return this._readerWriter.entries[Symbol.iterator]();
    }

    public values() {
        return this._readerWriter.values[Symbol.iterator]();
    }

    public keys() {
        return this._readerWriter.keys[Symbol.iterator]();
    }

    public lookup(key: TKey) {
        return this._readerWriter.lookup(key);
    }

    public dispose() {
        this._cleanUp.dispose();
    }

    public getKey(item: TObject) {
        return this._keySelector?.(item)!;
    }

    readonly [Symbol.toStringTag] = 'ObservableCache' as const;
}
