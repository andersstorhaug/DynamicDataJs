export class PersonEmpKey {
    public static create(personEmployment: PersonEmployment) {
        return new PersonEmpKey(personEmployment.name, personEmployment.company);
    }

    private readonly _name: string;
    private readonly _company: string;

    public constructor(name: string, company: string) {
        this._name = name;
        this._company = company;
    }

    toString() {
        return `${this._name},${this._company}`;
    }
}

export class PersonEmployment {
    public readonly name: string;
    public readonly company: string;
    public readonly key: PersonEmpKey;

    public constructor(name: string, company: string) {
        this.name = name;
        this.company = company;
        this.key = PersonEmpKey.create(this);
    }

    public toString() {
        return `Name: ${this.name}, Company: ${this.company}`;
    }
}
