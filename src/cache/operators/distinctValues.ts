import { OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { DistinctChangeSet } from '../DistinctChangeSet';
import { map } from 'rxjs/operators';
import { notEmpty } from './notEmpty';
import { ChangeSet } from '../ChangeSet';
import { Change } from '../Change';
import { deepEqualMapAdapter } from '../../util/deepEqualMapAdapter';
import { defaultMapAdapter } from '../../util/defaultMapAdapter';

/**
 * Selects distinct values from the source, using the specified value selector
 * @category Operator
 * @typeparam TObject The type of the source
 * @typeparam TValue The type of the destination
 * @param source The source
 * @param valueSelector The transform factory
 */
export function distinctValues<TObject, TKey, TValue>(
    valueSelector: (value: TObject) => TValue,
    deepEqual?: boolean,
): OperatorFunction<IChangeSet<TObject, TKey>, DistinctChangeSet<TValue>> {
    const _valueCounters = new Map<TValue, number>();
    const _keyCounters = new Map<TKey, number>();
    const _itemCache = new Map<TKey, TValue>();

    const _valueCountersAdapter = deepEqual ? deepEqualMapAdapter(_valueCounters) : defaultMapAdapter(_valueCounters);

    return function distinctValuesOperator(source) {
        return source.pipe(map(calculate), notEmpty());
    };

    function addKeyAction(key: TKey, value: TValue) {
        const count = _keyCounters.get(key);
        if (count !== undefined) {
            _keyCounters.set(key, count + 1);
        } else {
            _keyCounters.set(key, 1);
            _itemCache.set(key, value);
        }
    }

    function removeKeyAction(key: TKey) {
        const counter = _keyCounters.get(key);
        if (counter === undefined) {
            return;
        }

        //decrement counter
        const newCount = counter - 1;
        _keyCounters.set(key, newCount);
        if (newCount !== 0) {
            return;
        }

        //if there are none, then remove from cache
        _keyCounters.delete(key);
        _itemCache.delete(key);
    }

    function calculate(changes: IChangeSet<TObject, TKey>): DistinctChangeSet<TValue> {
        const result = new ChangeSet<TValue, TValue>();

        function addValueAction(value: TValue) {
            const count = _valueCountersAdapter.get(value);
            if (count !== undefined) {
                _valueCountersAdapter.set(value, count + 1);
            } else {
                _valueCountersAdapter.set(value, 1);
                result.add(Change.add(value, value));
            }
        }

        function removeValueAction(value: TValue) {
            const counter = _valueCountersAdapter.get(value);
            if (counter === undefined) {
                return;
            }

            //decrement counter
            const newCount = counter - 1;
            _valueCountersAdapter.set(value, newCount);
            if (newCount !== 0) {
                return;
            }

            //if there are none, then remove and notify
            _valueCountersAdapter.delete(value);
            result.add(Change.remove(value, value));
        }

        for (const change of changes) {
            const key = change.key;
            switch (change.reason) {
                case 'add': {
                    const value = valueSelector(change.current);
                    addKeyAction(key, value);
                    addValueAction(value);
                    break;
                }
                case 'refresh':
                case 'update': {
                    const value = valueSelector(change.current);
                    const previous = _itemCache.get(key)!;
                    if (value === previous) {
                        continue;
                    }

                    removeValueAction(previous);
                    addValueAction(value);
                    _itemCache.set(key, value);
                    break;
                }
                case 'remove': {
                    const previous = _itemCache.get(key)!;
                    removeKeyAction(key);
                    removeValueAction(previous);
                    break;
                }
            }
        }
        return result;
    }
}
