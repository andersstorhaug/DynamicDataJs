import { finalize, tap } from 'rxjs';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { transform } from '../../src/cache/operators/transform';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { Person } from '../domain/Person';
import { shareCache } from '../../src/cache/operators/shareCache';

describe('ShareCacheFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.name));
    });

    afterEach(() => {
        _source.dispose();
    });

    it('ChainIsInvokedOnceForMultipleSubscribers', () => {
        let created = 0;
        let disposals = 0;

        //Some expensive transform (or chain of operations)
        var longChain = _source.connect().pipe(
            transform(p => p),
            tap(_ => created++),
            finalize(() => disposals++),
            shareCache(),
        );

        const suscriber1 = longChain.subscribe();
        const suscriber2 = longChain.subscribe();
        const suscriber3 = longChain.subscribe();

        _source.addOrUpdate(new Person('Name', 10));
        suscriber1.unsubscribe();
        suscriber2.unsubscribe();
        suscriber3.unsubscribe();

        expect(created).toBe(1);
        expect(disposals).toBe(1);
    });

    it('CanResubscribe', () => {
        let created = 0;
        let disposals = 0;

        //must have data so transform is invoked
        _source.addOrUpdate(new Person('Name', 10));

        //Some expensive transform (or chain of operations)
        var longChain = _source.connect().pipe(
            transform(p => p),
            tap(_ => created++),
            finalize(() => disposals++),
            shareCache(),
        );

        var subscriber = longChain.subscribe();
        subscriber.unsubscribe();

        subscriber = longChain.subscribe();
        subscriber.unsubscribe();

        expect(created).toBe(2);
        expect(disposals).toBe(2);
    });
});
