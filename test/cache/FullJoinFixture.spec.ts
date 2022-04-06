import { fullJoin, ISourceCache, ISourceUpdater, SourceCache, updateable } from '../../src';
import { every, some, count } from 'ix/iterable';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { Device } from '../domain/Device';
import { DeviceWithMetadata } from '../domain/DeviceWithMetadata';
import { DeviceMetadata } from '../domain/DeviceMetadata';

describe('FullJoinFixture', () => {
    let _left: ISourceCache<Device, string> & ISourceUpdater<Device, string>;
    let _right: ISourceCache<DeviceMetadata, string> & ISourceUpdater<DeviceMetadata, string>;
    let _result: ChangeSetAggregator<DeviceWithMetadata, string>;

    beforeEach(() => {
        _left = updateable(new SourceCache<Device, string>(device => device.name));
        _right = updateable(new SourceCache<DeviceMetadata, string>(device => device.deviceName));

        _result = asAggregator(
            _left.connect().pipe(
                fullJoin(
                    _right.connect(),
                    meta => meta.deviceName,
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

        expect(every(_result.data.values(), { predicate: value => !!value.metadata })).toBe(false);

        expect(every(_result.data.values(), { predicate: value => !!value.device })).toBe(true);
    });

    it('AddRightOnly', () => {
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);

        expect(_result.data.size).toBe(3);
        expect(_result.data.lookup('Device1')).toBeDefined();
        expect(_result.data.lookup('Device2')).toBeDefined();
        expect(_result.data.lookup('Device3')).toBeDefined();

        expect(every(_result.data.values(), { predicate: value => !!value.metadata })).toBe(true);
        expect(every(_result.data.values(), { predicate: value => !!value.device })).toBe(false);
    });

    it('AddLeftThenRight', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);

        expect(3).toBe(_result.data.size);
        expect(every(_result.data.values(), { predicate: value => !!value.metadata })).toBe(true);
    });

    it('RemoveVarious', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);

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
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);

        expect(_result.data.size).toBe(3);

        expect(every(_result.data.values(), { predicate: value => !!value.metadata })).toBe(true);
    });

    it('UpdateRight', () => {
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);

        expect(_result.data.size).toBe(3);

        expect(every(_result.data.values(), { predicate: value => value.metadata?.isAutoConnect === false })).toBe(true);

        _right.addOrUpdate(new DeviceMetadata(2, 'Device2', true));

        expect(_result.data.lookup('Device2')?.metadata?.isAutoConnect).toBe(true);
    });

    afterEach(() => {
        _left.dispose();
        _right.dispose();
        _result.dispose();
    });
});
