import { count, every } from 'ix/iterable';
import { changeKey, innerJoin, ISourceCache, ISourceUpdater, SourceCache, updateable } from '../../src';
import { Device } from '../domain/Device';
import { DeviceMetadata } from '../domain/DeviceMetadata';
import { DeviceWithMetadata } from '../domain/DeviceWithMetadata';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';

describe('InnerJoinFixture', () => {
    let _left: ISourceCache<Device, string> & ISourceUpdater<Device, string>;
    let _right: ISourceCache<DeviceMetadata, number> & ISourceUpdater<DeviceMetadata, number>;
    let _result: ChangeSetAggregator<DeviceWithMetadata, string>;

    beforeEach(() => {
        _left = updateable(new SourceCache<Device, string>(value => value.name));
        _right = updateable(new SourceCache<DeviceMetadata, number>(value => value.id));

        const joined = _left.connect().pipe(
            innerJoin(
                _right.connect(),
                meta => meta.deviceName,
                (key, device, meta) => new DeviceWithMetadata(key.left, device, meta),
            ),
            changeKey((_value, key) => key.toString()),
        );

        _result = asAggregator(joined);
    });

    afterEach(() => {
        _left?.dispose();
        _right?.dispose();
        _result?.dispose();
    });

    it('AddLeftOnly', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);

        expect(_result.data.size).toBe(0);
    });

    it('AddRightOnly', () => {
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);

        expect(_result.data.size).toBe(0);
    });

    it('AddLeftThenRight', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);

        expect(_result.data.size).toBe(3);
        expect(every(_result.data.values(), { predicate: value => !!value.metadata }));
    });

    it('RemoveVarious', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);

        expect(_result.data.size).toBe(3);
        expect(_result.data.lookup('Device1,1')).toBeDefined();
        expect(_result.data.lookup('Device2,2')).toBeDefined();
        expect(_result.data.lookup('Device3,3')).toBeDefined();

        _right.removeKey(3);

        expect(_result.data.size).toBe(2);

        _left.removeKey('Device1');

        expect(_result.data.size).toBe(1);
        expect(_result.data.lookup('Device2,2')).toBeDefined();
    });

    it('AddRightThenLeft', () => {
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);

        expect(_result.data.size).toBe(3);
    });

    it('UpdateRight', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);

        expect(_result.data.size).toBe(3);
        expect(_result.data.lookup('Device2,2')?.metadata?.isAutoConnect).toBe(false);

        _right.addOrUpdate(new DeviceMetadata(2, 'Device2', true));

        expect(_result.data.lookup('Device2,2')?.metadata?.isAutoConnect).toBe(true);

        _right.addOrUpdate(new DeviceMetadata(2, 'Device4', true));

        expect(_result.data.size).toBe(2);
    });

    it('MultipleRight', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);
        _right.addOrUpdateValues([
            new DeviceMetadata(1, 'Device1'),
            new DeviceMetadata(2, 'Device3'), // Deliberate
            new DeviceMetadata(3, 'Device3'),
        ]);

        expect(_result.data.size).toBe(3);
        expect(count(_result.data.values(), { predicate: value => value.device?.name === 'Device3' })).toBe(2);
    });

    it('MoreRight', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3'), new DeviceMetadata(4, 'Device4')]);

        expect(_result.data.size).toBe(3);
        expect(_result.data.lookup('Device4,4')).toBeUndefined();
    });
});
