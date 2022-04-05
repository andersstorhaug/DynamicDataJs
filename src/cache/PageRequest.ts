export class PageRequest {
    public constructor(public readonly page = 1, public readonly size = 25) {
        if (page < 0) throw new RangeError('Page must be positive');
        if (size < 0) throw new RangeError('Size must be positive');
    }
    public static readonly default = new PageRequest();
    public static readonly empty = new PageRequest(0, 0);
}
