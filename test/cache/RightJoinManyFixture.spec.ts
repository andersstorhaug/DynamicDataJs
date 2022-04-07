import { first, from, range, toArray } from 'ix/iterable';
import { groupBy, map } from 'ix/iterable/operators';
import { ISourceCache, ISourceUpdater, rightJoinMany, SourceCache, updateable } from '../../src';
import { ParentAndChildren } from '../domain/ParentAndChildren';
import { Person } from '../domain/Person';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';

describe('RightJoinManyFixture', () => {
    let _people: ISourceCache<Person, string> & ISourceUpdater<Person, string>;

    let _result: ChangeSetAggregator<ParentAndChildren, string>;

    beforeEach(() => {
        _people = updateable(new SourceCache<Person, string>(p => p.name));

        _result = asAggregator(
            _people.connect().pipe(
                rightJoinMany(
                    _people.connect(),
                    pac => pac.parentName,
                    (_key, person, grouping) => {
                        return new ParentAndChildren(person, toArray(grouping.values()));
                    },
                ),
            ),
        );
    });

    afterEach(() => {
        _people.dispose();
        _result.dispose();
    });

    it('AddChild', () => {
        const people = toArray(range(1, 10).pipe(map(i => new Person('Person' + i, i, '', 'Person' + parentId(i, 10)))));

        _people.addOrUpdateValues(people);

        const person11 = new Person('Person11', 100, '', 'Person3');

        _people.addOrUpdate(person11);

        assertDataIsCorrectlyFormed([...people, person11]);
    });

    it('AddLeftOnly', () => {
        const people = toArray(range(1, 10).pipe(map(i => new Person('Person' + i, i))));

        _people.addOrUpdateValues(people);

        expect(_result.data.size).toBe(1);

        const values = toArray(_result.data.values());

        expect(first(_result.data.values())?.parent).toBeUndefined();
    });

    it('AddPeopleWithParents', () => {
        const people = toArray(range(1, 10).pipe(map(i => new Person('Person' + i, i, '', 'Person' + parentId(i, 10)))));

        _people.addOrUpdateValues(people);

        assertDataIsCorrectlyFormed(people);
    });

    it('RemoveChild', () => {
        const people = toArray(range(1, 10).pipe(map(i => new Person('Person' + i, i, '', 'Person' + parentId(i, 10)))));

        _people.addOrUpdateValues(people);

        const last = people[people.length - 1];

        _people.remove(last);

        const updatedPeople = people.filter(p => p.name != last.name);

        assertDataIsCorrectlyFormed(updatedPeople, last.name);
    });

    it('UpdateChild', () => {
        const people = toArray(range(1, 10).pipe(map(i => new Person('Person' + i, i, '', 'Person' + parentId(i, 10)))));

        _people.addOrUpdateValues(people);

        const current6 = people[5];
        const person6 = new Person('Person6', 100, '', current6.parentName);

        _people.addOrUpdate(person6);

        const updatedPeople = [...people.filter(p => p.name != person6.name), person6];

        assertDataIsCorrectlyFormed(updatedPeople);
    });

    it('UpdateParent', () => {
        const people = toArray(range(1, 10).pipe(map(i => new Person('Person' + i, i, '', 'Person' + parentId(i, 10)))));

        _people.addOrUpdateValues(people);

        const current10 = people[people.length - 1];
        const person10 = new Person('Person10', 100, '', current10.parentName);

        _people.addOrUpdate(person10);

        var updatedPeople = [...people.slice(0, -1), person10];

        assertDataIsCorrectlyFormed(updatedPeople);
    });

    function assertDataIsCorrectlyFormed(allPeople: Person[], ...missingParents: string[]) {
        const grouped = toArray(from(allPeople).pipe(groupBy(p => p.parentName)));

        expect(_result.data.size).toBe(grouped.length);

        for (let grouping of grouped) {
            if (missingParents.length > 0 && missingParents.includes(grouping.key)) continue;

            const result = _result.data.lookup(grouping.key);

            expect(result).toBeDefined();
            expect(new Set(result!.children)).toEqual(new Set(grouping));
        }
    }

    function parentId(index: number, totalPeople: number) {
        if (index < 5) return 10;
        if (index == totalPeople - 1) return 1;
        if (index == totalPeople) return 1;
        return index + 1;
    }
});
