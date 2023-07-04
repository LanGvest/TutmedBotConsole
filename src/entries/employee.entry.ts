// noinspection JSUnusedLocalSymbols,JSUnusedGlobalSymbols

import {Matchable} from "../utils/entries";

export type AnyEmployeeEntry = PointEmployeeEntry;
export type PlainEmployee = string;

function validatePlainEmployee(value: string): PlainEmployee {
	return value.replace(/[^а-яё]/gi, "").toLowerCase().replace(/ё/g, "е") as PlainEmployee;
}

class PointEmployeeEntry implements Matchable {
	private readonly target: PlainEmployee;

	public constructor(target: PlainEmployee) {
		this.target = validatePlainEmployee(target);
	}

	matches(value: string): boolean {
		value = validatePlainEmployee(value);
		return this.target === value;
	}
}

export class EmployeeEntry {
	private constructor() {}

	public static point(target: PlainEmployee): PointEmployeeEntry {
		return new PointEmployeeEntry(target);
	}
}