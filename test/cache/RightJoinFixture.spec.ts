import { count, every } from 'ix/iterable';
import { ISourceCache, ISourceUpdater, rightJoin, SourceCache, updateable } from '../../src';
import { Device } from '../domain/Device';
import { DeviceMetadata } from '../domain/DeviceMetadata';
import { DeviceWithMetadata } from '../domain/DeviceWithMetadata';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';

describe('RightJoinFixture', () => {
    let _left: ISourceCache<Device, string> & ISourceUpdater<Device, string>;
    let _right: ISourceCache<DeviceMetadata, number> & ISourceUpdater<DeviceMetadata, number>;
    let _result: ChangeSetAggregator<DeviceWithMetadata, number>;

    beforeEach(() => {
        _left = updateable(new SourceCache<Device, string>(device => device.name));
        _right = updateable(new SourceCache<DeviceMetadata, number>(device => device.key));

        _result = asAggregator(
            _left.connect().pipe(
                rightJoin(
                    _right.connect(),
                    meta => meta.name,
                    (_key, device, meta) => new DeviceWithMetadata(meta.name, device, meta),
                ),
            ),
        );
    });

    afterEach(() => {
        _left.dispose();
        _right.dispose();
        _result.dispose();
    });

    it('AddLeftOnly', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);

        expect(_result.data.size).toBe(0);
    });

    it('AddLeftThenRight', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);

        expect(3).toBe(_result.data.size);
        expect(every(_result.data.values(), { predicate: value => !!value.metadata })).toBe(true);
    });

    it('AddRightThenLeft', () => {
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);

        expect(_result.data.size).toBe(3);

        expect(every(_result.data.values(), { predicate: value => !!value.metadata })).toBe(true);
    });

    it('RemoveVarious', () => {
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);

        _right.removeKey(3);

        expect(_result.data.size).toBe(2);
        expect(count(_result.data.values(), { predicate: value => !!value.metadata })).toBe(2);

        _left.removeKey('Device1');

        expect(_result.data.lookup(1)).toBeDefined();
        expect(count(_result.data.values(), { predicate: dwm => !dwm.device })).toBe(1);
    });

    it('UpdateRight', () => {
        _right.addOrUpdateValues([new DeviceMetadata(1, 'Device1'), new DeviceMetadata(2, 'Device2'), new DeviceMetadata(3, 'Device3')]);
        _left.addOrUpdateValues([new Device('Device1'), new Device('Device2'), new Device('Device3')]);

        expect(_result.data.size).toBe(3);

        expect(every(_result.data.values(), { predicate: value => value.metadata?.isAutoConnect === false })).toBe(true);

        _right.addOrUpdate(new DeviceMetadata(2, 'Device2', true));

        expect(_result.data.lookup(2)?.metadata?.isAutoConnect).toBe(true);
    });
});
