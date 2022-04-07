import { OperatorFunction } from 'rxjs';
import { Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { IGrouping } from '../IGrouping';
import { ImmutableGroup } from '../ImmutableGroup';
import { Cache } from '../Cache';
import { groupWithImmutableState } from './groupWithImmutableState';
import { leftJoin } from './leftJoin';

/**
 * Groups the right data source and joins the resulting group to the left data source, matching these using the specified key selector. Results are included when the left and right have matching values.
 * This is the equivalent of SQL left join.
 * @category Operator
 * @param right The right data source.
 * @param rightKeySelector Specify the foreign key on the right data source.
 * @param resultSelector The result selector used to transform the combined data into.
 * @returns An observable which will emit change sets.
 */
export function leftJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(
    right: Observable<IChangeSet<TRight, TRightKey>>,
    rightKeySelector: (value: TRight) => TLeftKey,
    resultSelector: (key: TLeftKey, left: TLeft, right: IGrouping<TRight, TRightKey, TLeftKey>) => TDestination,
): OperatorFunction<IChangeSet<TLeft, TLeftKey>, IChangeSet<TDestination, TLeftKey>> {
    return left => {
        const rightGrouped = right.pipe(groupWithImmutableState(rightKeySelector));

        return left.pipe(
            leftJoin(
                rightGrouped,
                group => group.key,
                (key, leftItem, rightGroup) => resultSelector(key, leftItem, rightGroup ?? new ImmutableGroup(key, Cache.empty<TRight, TRightKey>())),
            ),
        );
    };
}
