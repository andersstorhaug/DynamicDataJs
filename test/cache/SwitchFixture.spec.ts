import { range, toArray } from 'ix/iterable';
import { map } from 'ix/iterable/operators';
import { BehaviorSubject, Subject } from 'rxjs';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { Person } from '../domain/Person';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { switchCache } from '../../src/cache/operators';

describe('SwitchFixture', () => {
    let _switchable: Subject<ISourceCache<Person, string>>;
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string>;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.name));
        _switchable = new BehaviorSubject<ISourceCache<Person, string>>(_source);
        _results = asAggregator(_switchable.pipe(switchCache()));
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('PopulatesFirstSource', () => {
        _source.addOrUpdateValues(getData(1, 100));

        expect(_results.data.size).toBe(100);
    });

    it('ClearsForNewSource', () => {
        const initial = getData(1, 100);

        _source.addOrUpdateValues(initial);

        expect(_results.data.size).toBe(100);

        const newSource = updateable(new SourceCache<Person, string>(p => p.name));
        _switchable.next(newSource);

        expect(_results.data.size).toBe(0);

        newSource.addOrUpdateValues(initial);
        expect(_results.data.size).toBe(100);

        newSource.addOrUpdateValues(getData(101, 100));
        expect(_results.data.size).toBe(200);
    });

    it('SuppressesEmpty', () => {
        _source.edit(() => {});

        expect(_results.messages.length).toBe(0);
    });

    it('Allows for empty', () => {
        _results = asAggregator(_switchable.pipe(switchCache({ suppressEmptyChangeSets: false })));
        _source.edit(() => {});

        expect(_results.messages.length).toBe(1);
    });
});

function getData(start: number, count: number): readonly Person[] {
    return toArray(range(start, count).pipe(map(i => new Person(`Person${i}`, i))));
}
