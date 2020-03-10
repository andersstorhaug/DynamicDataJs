/**
 *
 */
import { Disposable, IDisposable, IDisposableOrSubscription } from './Disposable';
export class CompositeDisposable extends Set<IDisposableOrSubscription> implements IDisposable {
    private _isDisposed = false;

    constructor(...disposables: IDisposableOrSubscription[]) {
        super(disposables);
    }

    public get isDisposed() {
        return this._isDisposed;
    }

    public dispose() {
        this._isDisposed = true;
        if (this.size) {
            this.forEach(disposable => Disposable.of(disposable).dispose());
            this.clear();
        }
    }

    public add(...disposables: IDisposableOrSubscription[]) {
        if (this.isDisposed) {
            disposables.forEach((item) => Disposable.of(item).dispose());
        } else {
            disposables.forEach((item) => this.add(item));
        }
        return this;
    }

    public remove(disposable: IDisposableOrSubscription) {
        this.delete(disposable);
        return this;
    }
}