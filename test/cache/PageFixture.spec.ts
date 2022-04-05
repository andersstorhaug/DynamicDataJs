import { BehaviorSubject, Subject } from 'rxjs';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { PageRequest } from '../../src/cache/PageRequest';
import { Person } from '../domain/Person';
import { Comparer } from '../../src/cache/Comparer';
import { sort, page } from '../../src/cache/operators';
import { SortComparer } from '../../src';
import { IPagedChangeSet } from '../../src/cache';
import { randomPersonGenerator } from '../domain/RandomPersonGenerator';
import { orderBy, take, map, skip } from 'ix/iterable/operators';
import { from, toArray } from 'ix/iterable';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';

describe('PageFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _aggregators: ChangeSetAggregator<Person, string, IPagedChangeSet<Person, string>>;

    let _comparer: Comparer<Person>;
    let _sort: Subject<Comparer<Person>>;
    let _pager: Subject<PageRequest>;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.name));
        _comparer = SortComparer.ascending<Person>('name').thenByAscending('age');
        _sort = new BehaviorSubject<Comparer<Person>>(_comparer);
        _pager = new BehaviorSubject<PageRequest>(new PageRequest(1, 25));

        _aggregators = asAggregator(_source.connect().pipe(sort(undefined, _sort, undefined, 200), page(_pager)));
    });

    afterEach(() => {
        _source.dispose();
        _aggregators.dispose();
    });

    it('ReorderBelowThreshold', () => {
        const people = toArray(randomPersonGenerator(50));
        _source.addOrUpdateValues(people);

        const changed = SortComparer.descending<Person>('age').thenByAscending('name');
        _sort.next(changed);

        const expectedResult = toArray(
            from(people).pipe(
                orderBy(p => p, changed),
                take(25),
                map(p => p.name),
            ),
        );
        const actualResult = toArray(
            from(_aggregators.messages[_aggregators.messages.length - 1].sortedItems).pipe(
                map(([_, p]) => p),
                map(p => p.name),
            ),
        );

        expect(actualResult).toEqual(expectedResult);
    });

    it('PageInitialBatch', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        expect(_aggregators.data.size).toBe(25);
        expect(_aggregators.messages[0].response.pageSize).toBe(25);
        expect(_aggregators.messages[0].response.page).toBe(1);
        expect(_aggregators.messages[0].response.pages).toBe(4);

        const expectedResult = toArray(
            from(people).pipe(
                orderBy(p => p, _comparer),
                take(25),
                map(p => p.name),
            ),
        );
        const actualResult = toArray(from(_aggregators.messages[0].sortedItems).pipe(map(([_, p]) => p.name)));

        expect(actualResult).toEqual(expectedResult);
    });

    it('ChangePage', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);
        _pager.next(new PageRequest(2, 25));

        const expectedResult = toArray(
            from(people).pipe(
                orderBy(p => p, _comparer),
                skip(25),
                take(25),
                map(p => p.name),
            ),
        );
        const actualResult = toArray(from(_aggregators.messages[1].sortedItems).pipe(map(([_, p]) => p.name)));

        expect(actualResult).toEqual(expectedResult);
    });

    it('ChangePageSize', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);
        _pager.next(new PageRequest(1, 50));

        expect(_aggregators.messages[1].response.page).toBe(1);

        const expectedResult = toArray(
            from(people).pipe(
                orderBy(p => p, _comparer),
                take(50),
                map(p => p.name),
            ),
        );
        const actualResult = toArray(from(_aggregators.messages[1].sortedItems).pipe(map(([_, p]) => p.name)));

        expect(actualResult).toEqual(expectedResult);
    });

    it('PageGreaterThanNumberOfPagesAvailable', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);
        _pager.next(new PageRequest(10, 25));

        expect(_aggregators.messages[1].response.page).toBe(4);

        const expectedResult = toArray(
            from(people).pipe(
                orderBy(p => p, _comparer),
                skip(75),
                take(25),
                map(p => p.name),
            ),
        );
        const actualResult = toArray(from(_aggregators.messages[1].sortedItems).pipe(map(([_, p]) => p.name)));

        expect(actualResult).toEqual(expectedResult);
    });

    it('ThrowsForNegativeSizeParameters', () => {
        expect(() => {
            _pager.next(new PageRequest(1, -1));
        }).toThrow();
    });

    it('ThrowsForNegativePage', () => {
        expect(() => {
            _pager.next(new PageRequest(-1, 1));
        }).toThrow();
    });
});
