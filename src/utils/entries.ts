// noinspection JSUnusedGlobalSymbols

export enum Direction {
	ASC,
	DESC
}

export interface Matchable {
	matches(value: string): boolean
}

export abstract class DirectionalEntry {
	#direction: Direction = Direction.ASC;

	public asc(): this {
		this.#direction = Direction.ASC;
		return this;
	}

	public desc(): this {
		this.#direction = Direction.DESC;
		return this;
	}

	public getDirection(): Direction {
		return this.#direction;
	}
}