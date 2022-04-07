import { getPrimitive } from '../util/getPrimitive';

export class JoinKey<TLeftKey, TRightKey> {
    private readonly _key: string;

    constructor(public readonly left: TLeftKey, public readonly right: TRightKey) {
        this._key = `${getPrimitive(left)},${getPrimitive(right)}`;
    }

    toString() {
        return this._key;
    }
}
