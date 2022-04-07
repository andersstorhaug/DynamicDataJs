import { map, Observable, OperatorFunction, filter as rxFilter, NEVER, merge } from 'rxjs';
import { ICache } from '../ICache';
import { IChangeSet } from '../IChangeSet';
import { Cache } from '../Cache';
import { Change } from '../Change';
import { ChangeReason } from '../ChangeReason';
import { from as ixFrom } from 'ix/iterable';
import { map as ixMap, groupBy as ixGroupBy } from 'ix/iterable/operators';
import { ChangeSet } from '../ChangeSet';
import { IImmutableGroupChangeSet } from '../IImmutableGroupChangeSet';
import { IGrouping } from '../IGrouping';
import { ImmutableGroupChangeSet } from '../ImmutableGroupChangeSet';
import { ImmutableGroup } from '../ImmutableGroup';
import { getPrimitive } from '../../util/getPrimitive';

export function groupWithImmutableState<TObject, TKey, TGroupKey>(
    groupSelectorKey: (item: TObject) => TGroupKey,
    regrouper?: Observable<void>,
): OperatorFunction<IChangeSet<TObject, TKey>, IImmutableGroupChangeSet<TObject, TKey, TGroupKey>> {
    return source => {
        return new Observable(subscriber => {
            if (!regrouper) regrouper = NEVER;

            const grouper = new Grouper<TObject, TKey, TGroupKey>(groupSelectorKey);

            const groups = source.pipe(
                map(changes => grouper.update(changes)),
                rxFilter(changes => changes.size > 0),
            );

            const regroup = regrouper.pipe(
                map(_ => grouper.regroup()),
                rxFilter(changes => changes.size > 0),
            );

            return merge(groups, regroup).subscribe(subscriber);
        });
    };
}

class Grouper<TObject, TKey, TGroupKey> {
    private readonly _allGroupings = new Cache<GroupCache<TObject, TKey, TGroupKey>, TGroupKey>();
    private readonly _itemCache = new Cache<ChangeWithGroup<TObject, TKey, TGroupKey>, TKey>();

    constructor(private readonly _groupSelectorKey: (item: TObject) => TGroupKey) {}

    regroup() {
        // re-evaluate all items in the group
        const items = ixFrom(this._itemCache.entries()).pipe(
            ixMap(item =>
                Change.create<TObject, TKey>({
                    reason: 'refresh',
                    key: item[0],
                    current: item[1].item,
                    currentIndex: -1,
                }),
            ),
        );

        return this.handleUpdates(new ChangeSet<TObject, TKey>(items));
    }

    update(updates: IChangeSet<TObject, TKey>) {
        return this.handleUpdates(updates);
    }

    private createMissingKeyError(reason: ChangeReason, key: TKey) {
        return new Error(`${key} is missing from previous group on ${reason}`);
    }

    private getGroupState(key: TGroupKey, cache: ICache<TObject, TKey>) {
        return new ImmutableGroup<TObject, TKey, TGroupKey>(key, cache);
    }

    private createGroupChange(reason: ChangeReason, key: TGroupKey, current: IGrouping<TObject, TKey, TGroupKey>, previous?: IGrouping<TObject, TKey, TGroupKey>) {
        return Change.create<IGrouping<TObject, TKey, TGroupKey>, TGroupKey>({
            reason,
            key,
            current,
            currentIndex: -1,
        });
    }

    private createChangeSet(initialGroupState: Cache<IGrouping<TObject, TKey, TGroupKey>, TGroupKey>) {
        const result: Change<IGrouping<TObject, TKey, TGroupKey>, TGroupKey>[] = [];

        for (let initialGroup of initialGroupState) {
            const key = initialGroup[0];
            const current = this._allGroupings.lookup(key);

            if (!current?.cache.size) {
                this._allGroupings.removeKey(key);
                result.push(this.createGroupChange('remove', key, initialGroup[1]));
            } else {
                const currentState = this.getGroupState(current.key, current.cache);

                if (initialGroup[1].size === 0) {
                    result.push(this.createGroupChange('add', key, currentState));
                } else {
                    const previousState = initialGroup[1];
                    result.push(this.createGroupChange('update', key, currentState, previousState));
                }
            }
        }

        return new ImmutableGroupChangeSet<TObject, TKey, TGroupKey>(result);
    }

    private getCache(key: TGroupKey): [GroupCache<TObject, TKey, TGroupKey>, boolean] {
        let cache = this._allGroupings.lookup(key);

        if (cache) {
            return [cache, false];
        }

        cache = new GroupCache(key);
        this._allGroupings.addOrUpdate(cache, key);
        return [cache, true];
    }

    private handleUpdates(changes: Iterable<Change<TObject, TKey>>): IImmutableGroupChangeSet<TObject, TKey, TGroupKey> {
        // need to keep track of effected groups to calculate correct notifications
        var initialStateOfGroups = new Cache<IGrouping<TObject, TKey, TGroupKey>, TGroupKey>();

        // 1. Group all items
        var grouped = ixFrom(changes).pipe(
            ixMap(change => new ChangeWithGroup<TObject, TKey, TGroupKey>(this._groupSelectorKey(change.current), change)),
            ixGroupBy(change => getPrimitive(change.groupKey)),
        );

        for (let group of grouped) {
            const [groupCache, _] = this.getCache(group.key);
            const cacheToModify = groupCache.cache;

            if (initialStateOfGroups.lookup(group.key) === undefined) {
                initialStateOfGroups.addOrUpdate(this.getGroupState(group.key, groupCache.cache), group.key);
            }

            // 1. Iterate through group changes and maintain the current group
            for (let current of group) {
                switch (current.reason) {
                    case 'add':
                        cacheToModify.addOrUpdate(current.item, current.key);
                        this._itemCache.addOrUpdate(current, current.key);
                        break;

                    case 'update': {
                        cacheToModify.addOrUpdate(current.item, current.key);

                        // check whether the previous item was in a different group. If so remove from old group
                        const previous = this._itemCache.lookup(current.key);

                        if (previous === undefined) throw this.createMissingKeyError('update', current.key);

                        if (previous.groupKey !== current.groupKey) {
                            this.removeFromOldGroup(initialStateOfGroups, previous.groupKey, current.key);
                        }

                        this._itemCache.addOrUpdate(current, current.key);
                        break;
                    }

                    case 'remove': {
                        const existing = cacheToModify.lookup(current.key);
                        if (existing !== undefined) {
                            cacheToModify.removeKey(current.key);
                        } else {
                            // this has been removed due to an underlying evaluate resulting in a remove
                            const previousGroup = this._itemCache.lookup(current.key);

                            if (previousGroup === undefined) throw this.createMissingKeyError('remove', current.key);

                            this.removeFromOldGroup(initialStateOfGroups, previousGroup.groupKey, current.key);
                        }

                        this._itemCache.removeKey(current.key);
                        break;
                    }

                    case 'refresh': {
                        // check whether the previous item was in a different group. If so remove from old group
                        const previous = this._itemCache.lookup(current.key);

                        if (previous !== undefined) {
                            if (previous.groupKey === current.groupKey) {
                                break;
                            }

                            this.removeFromOldGroup(initialStateOfGroups, previous.groupKey, current.key);

                            // add to new group because the group value has changed
                            cacheToModify.addOrUpdate(current.item, current.key);
                        } else {
                            cacheToModify.addOrUpdate(current.item, current.key);
                        }

                        this._itemCache.addOrUpdate(current, current.key);
                        break;
                    }
                }
            }
        }

        // 2. Produce and fire notifications [compare current and previous state]
        return this.createChangeSet(initialStateOfGroups);
    }

    removeFromOldGroup(groupState: Cache<IGrouping<TObject, TKey, TGroupKey>, TGroupKey>, groupKey: TGroupKey, currentKey: TKey) {
        const grouping = this._allGroupings.lookup(groupKey);

        if (grouping !== undefined) {
            if (!groupState.lookup(grouping.key) === undefined) {
                groupState.addOrUpdate(this.getGroupState(grouping.key, grouping.cache), grouping.key);
            }

            grouping.cache.removeKey(currentKey);
        }
    }
}

class GroupCache<TObject, TKey, TGroupKey> {
    readonly cache = new Cache<TObject, TKey>();
    constructor(public readonly key: TGroupKey) {}
}

class ChangeWithGroup<TObject, TKey, TGroupKey> {
    readonly item: TObject;
    readonly key: TKey;
    readonly reason: ChangeReason;

    constructor(public readonly groupKey: TGroupKey, change: Change<TObject, TKey>) {
        this.item = change.current;
        this.key = change.key;
        this.reason = change.reason;
    }
}
