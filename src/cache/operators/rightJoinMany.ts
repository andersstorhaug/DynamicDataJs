import { OperatorFunction } from 'rxjs';
import { Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { IGrouping } from '../IGrouping';
import { groupWithImmutableState } from './groupWithImmutableState';
import { rightJoin } from './rightJoin';

/**
 * Groups the right data source and joins the two sources matching them using the specified key selector, taking all right values and combining any matching left values.
 * This is the equivalent of SQL left join.
 * @category Operator
 * @param right The right data source.
 * @param rightKeySelector Specify the foreign key on the right data source.
 * @param resultSelector The result selector used to transform the combined data into.
 * @returns An observable which will emit change sets.
 */
export function rightJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(
    right: Observable<IChangeSet<TRight, TRightKey>>,
    rightKeySelector: (value: TRight) => TLeftKey,
    resultSelector: (key: TLeftKey, left: TLeft | undefined, right: IGrouping<TRight, TRightKey, TLeftKey>) => TDestination,
): OperatorFunction<IChangeSet<TLeft, TLeftKey>, IChangeSet<TDestination, TLeftKey>> {
    return left => {
        const rightGrouped = right.pipe(groupWithImmutableState(rightKeySelector));
        return left.pipe(rightJoin(rightGrouped, grouping => grouping.key, resultSelector));
    };
}
