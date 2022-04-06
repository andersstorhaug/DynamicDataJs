import { fullJoin, ISourceCache, ISourceUpdater, SourceCache, updateable } from '../../src';
import { every, some, count } from 'ix/iterable';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';

describe('FullJoinFixture', () => {
    let _left: ISourceCache<Device, string> & ISourceUpdater<Device, string>;
    let _right: ISourceCache<DeviceMetadata, string> & ISourceUpdater<DeviceMetadata, string>;
    let _result: ChangeSetAggregator<DeviceWithMetadata, string>;

    beforeEach(() => {
        _left = updateable(new SourceCache<Device, string>(device => device.name));
        _right = updateable(new SourceCache<DeviceMetadata, string>(device => device.name));

        _result = asAggregator(
            _left.connect().pipe(
                fullJoin(
                    _right.connect(),
                    meta => meta.name,
                    (key, device, meta) => new DeviceWithMetadata(key, device, meta),
                ),
            ),
        );
    });

    it('AddLeftOnly', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);

        expect(_result.data.size).toBe(3);
        expect(_result.data.lookup('Device1')).toBeDefined();
        expect(_result.data.lookup('Device2')).toBeDefined();
        expect(_result.data.lookup('Device3')).toBeDefined();

        expect(every(_result.data.values(), { predicate: value => !!value.metadata })).toBeFalsy();

        expect(every(_result.data.values(), { predicate: value => !!value.device })).toBeTruthy();
    });

    it('AddRightOnly', () => {
        _right.addOrUpdateValues([new DeviceMetadata('Device1'), new DeviceMetadata('Device2'), new DeviceMetadata('Device3')]);

        expect(_result.data.size).toBe(3);
        expect(_result.data.lookup('Device1')).toBeDefined();
        expect(_result.data.lookup('Device2')).toBeDefined();
        expect(_result.data.lookup('Device3')).toBeDefined();

        expect(every(_result.data.values(), { predicate: value => !!value.metadata })).toBeTruthy();
        expect(every(_result.data.values(), { predicate: value => !!value.device })).toBeFalsy();
    });

    it('AddLeftThenRight', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);
        _right.addOrUpdateValues([new DeviceMetadata('Device1'), new DeviceMetadata('Device2'), new DeviceMetadata('Device3')]);

        expect(3).toBe(_result.data.size);
        expect(every(_result.data.values(), { predicate: value => !!value.metadata })).toBeTruthy();
    });

    it('RemoveVarious', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);
        _right.addOrUpdateValues([new DeviceMetadata('Device1'), new DeviceMetadata('Device2'), new DeviceMetadata('Device3')]);

        expect(_result.data.lookup('Device1')).toBeDefined();
        expect(_result.data.lookup('Device2')).toBeDefined();
        expect(_result.data.lookup('Device3')).toBeDefined();

        _right.removeKey('Device3');

        expect(_result.data.size).toBe(3);
        expect(count(_result.data.values(), { predicate: value => !!value.metadata })).toBe(2);

        _left.removeKey('Device1');

        expect(_result.data.lookup('Device1')).toBeDefined();
        expect(_result.data.lookup('Device2')).toBeDefined();
        expect(_result.data.lookup('Device3')).toBeDefined();
    });

    it('AddRightThenLeft', () => {
        _right.addOrUpdateValues([new DeviceMetadata('Device1'), new DeviceMetadata('Device2'), new DeviceMetadata('Device3')]);
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);

        expect(_result.data.size).toBe(3);

        expect(every(_result.data.values(), { predicate: value => !!value.metadata })).toBeTruthy();
    });

    it('UpdateRight', () => {
        _right.addOrUpdateValues([new DeviceMetadata('Device1'), new DeviceMetadata('Device2'), new DeviceMetadata('Device3')]);
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);

        expect(_result.data.size).toBe(3);

        expect(every(_result.data.values(), { predicate: value => value.metadata?.isAutoConnect === false })).toBeTruthy();

        _right.addOrUpdate(new DeviceMetadata('Device2', true));

        expect(some(_result.data.values(), { predicate: value => value.metadata?.isAutoConnect === true })).toBeTruthy();
    });

    afterEach(() => {
        _left.dispose();
        _right.dispose();
        _result.dispose();
    });
});

class Device {
    constructor(public readonly name: string) {}
}

class DeviceMetadata {
    constructor(public readonly name: string, public readonly isAutoConnect: boolean = false) {}
}

class DeviceWithMetadata {
    constructor(public readonly key: string, public readonly device?: Device, public readonly metadata?: DeviceMetadata) {}
}
