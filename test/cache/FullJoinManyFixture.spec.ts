import { from, range, toArray, reduce } from 'ix/iterable';
import { map, distinct, union, filter } from 'ix/iterable/operators';
import { fullJoinMany, ISourceCache, ISourceUpdater, SourceCache, updateable } from '../../src';
import { ParentAndChildren } from '../domain/ParentAndChildren';
import { Person } from '../domain/Person';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';

describe('FullJoinManyFixture', () => {
    let _people: ISourceCache<Person, string> & ISourceUpdater<Person, string>;

    let _result: ChangeSetAggregator<ParentAndChildren, string>;

    beforeEach(() => {
        _people = updateable(new SourceCache<Person, string>(p => p.name));

        _result = asAggregator(
            _people.connect().pipe(
                fullJoinMany(
                    _people.connect(),
                    pac => pac.parentName,
                    (parentId, person, grouping) => new ParentAndChildren(person, toArray(grouping.values()), parentId),
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
        const people = toArray(range(1, 1000).pipe(map(i => new Person('Person' + i, i))));

        _people.addOrUpdateValues(people);

        assertDataIsCorrectlyFormed(people);
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

        assertDataIsCorrectlyFormed(updatedPeople);
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

    function assertDataIsCorrectlyFormed(allPeople: Person[]) {
        const people = reduce(allPeople, {
            seed: new Map<string, Person>(),
            callback: (result, p) => result.set(p.name, p),
        });

        const parentNames = from(allPeople).pipe(
            map(p => p.parentName),
            distinct(),
        );

        const childrenNames = from(allPeople).pipe(
            map(p => p.name),
            distinct(),
        );

        const all = toArray(
            parentNames.pipe(
                union(childrenNames),
                map(key => {
                    const parent = people.get(key);
                    const children = toArray(from(people.values()).pipe(filter(p => p.parentName === key)));
                    return new ParentAndChildren(parent, children, key);
                }),
            ),
        );

        expect(_result.data.size).toBe(all.length);

        for (let parentAndChild of all) {
            const result = parentAndChild.parentId !== undefined ? _result.data.lookup(parentAndChild.parentId) : undefined;

            expect(result).toBeDefined();
            expect(new Set(result?.children)).toEqual(new Set(parentAndChild.children));
        }
    }

    function parentId(index: number, totalPeople: number) {
        if (index < 5) return 11;
        if (index == totalPeople - 1) return 1;
        if (index == totalPeople) return 1;
        return index + 1;
    }
});
