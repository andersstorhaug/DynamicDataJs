import { OperatorFunction, Observable } from 'rxjs';
import { Cache } from '../Cache';
import { IChangeSet } from '../IChangeSet';
import { IGrouping } from '../IGrouping';
import { ImmutableGroup } from '../ImmutableGroup';
import { fullJoin } from './fullJoin';
import { groupWithImmutableState } from './groupWithImmutableState';

/**
 * Groups the right data source and joins the resulting group to the left data source, matching these using the specified key selector. Results are included when the left or the right has a value.
 * This is the equivalent of SQL full join.
 * @category Operator
 * @param right The right data source.
 * @param rightKeySelector Specify the foreign key on the right data source.
 * @param resultSelector The result selector used to transform the combined data into.
 * @returns An observable which will emit change sets.
 */
export function fullJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(
    right: Observable<IChangeSet<TRight, TRightKey>>,
    rightKeySelector: (value: TRight) => TLeftKey,
    resultSelector: (leftKey: TLeftKey, left: TLeft | undefined, right: IGrouping<TRight, TRightKey, TLeftKey>) => TDestination,
): OperatorFunction<IChangeSet<TLeft, TLeftKey>, IChangeSet<TDestination, TLeftKey>> {
    return left => {
        const rightGrouped = right.pipe(groupWithImmutableState(rightKeySelector));

        return left.pipe(
            fullJoin(
                rightGrouped,
                grouping => grouping.key,
                (leftKey, left, grouping) => resultSelector(leftKey, left, grouping ?? new ImmutableGroup<TRight, TRightKey, TLeftKey>(leftKey, Cache.empty<TRight, TRightKey>())),
            ),
        );
    };
}
