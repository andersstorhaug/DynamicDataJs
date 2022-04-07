import { Person } from './Person';

export class ParentAndChildren {
    public get count() {
        return this.children?.length ?? 0;
    }

    public constructor(public readonly parent?: Person, public readonly children?: Person[], public readonly parentId?: string) {}

    public toString() {
        return `Parent: ${this.parent}, (${this.count} children)`;
    }
}
