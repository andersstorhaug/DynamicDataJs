import { Person } from './Person';

export class ParentAndChildren {
    public readonly parent?: Person;
    public readonly children?: Person[];

    public get count() {
        return this.children?.length ?? 0;
    }

    public constructor(parent?: Person, children?: Person[]) {
        this.parent = parent;
        this.children = children;
    }

    public toString() {
        return `Parent: ${this.parent}, (${this.count} children)`;
    }
}
