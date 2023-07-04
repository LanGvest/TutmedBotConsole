// noinspection JSUnusedLocalSymbols,JSUnusedGlobalSymbols

import {DirectionalEntry, Matchable} from "../utils/entries";
import {getLogger} from "../utils/logger";
import {LoggerName} from "../enums/loggerName.enum";

const LOGGER = getLogger(LoggerName.ENTRIES);

export type AnyDateEntry = WeekendDateEntry | PointDateEntry | SpanDateEntry;

export type PlainDate = `${number}.${number}.${number}`;

const CURRENT_YEAR: number = new Date().getFullYear();

function validatePlainDate(value: string): PlainDate {
	const isAsc: boolean = /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(value);
	const isDesc: boolean = /^\d{4}\.\d{1,2}\.\d{1,2}$/.test(value);
	if(!isAsc && !isDesc) throw new TypeError(`Invalid plain date syntax '${value}'.`);
	const items: Array<number> = value.split(".").map(item => Number(item));
	if(isAsc) items.reverse();
	const y: number = items[0];
	const M: number = items[1];
	const d: number = items[2];
	if(y < CURRENT_YEAR || y > CURRENT_YEAR + 1) throw new RangeError(`Invalid year '${y}' in plain date '${value}'.`);
	if(M < 1 || M > 12) throw new RangeError(`Invalid month '${M}' in plain date '${value}'.`);
	if(d < 1 || d > 31) throw new RangeError(`Invalid day '${d}' in plain date '${value}'.`);
	return `${y.pad(4)}.${M.pad(2)}.${d.pad(2)}` as PlainDate;
}

class WeekendDateEntry extends DirectionalEntry implements Matchable {
	public constructor() {
		super();
	}

	public matches(value: string): boolean {
		try {
			value = validatePlainDate(value);
			const dayOfWeek = new Date(value).getDay();
			return dayOfWeek === 0 || dayOfWeek === 6;
		} catch(e) {
			LOGGER.strongWarning(e);
			return false;
		}
	}
}

class PointDateEntry implements Matchable {
	private readonly target: PlainDate;

	public constructor(target: PlainDate) {
		this.target = validatePlainDate(target);
	}

	matches(value: string): boolean {
		try {
			value = validatePlainDate(value);
			return this.target === value;
		} catch(e) {
			LOGGER.strongWarning(e);
			return false;
		}
	}
}

class SpanDateEntry extends DirectionalEntry implements Matchable {
	private readonly from: PlainDate;
	private readonly to: PlainDate;

	public constructor(from: PlainDate, to: PlainDate) {
		super();
		this.from = validatePlainDate(from);
		this.to = validatePlainDate(to);
		if(this.from >= this.to) throw new RangeError(`Invalid plain date span range. 'From' plain date '${from}' cannot be more than or equal to 'to' plain date '${to}'.`);
	}

	matches(value: string): boolean {
		try {
			value = validatePlainDate(value);
			return this.from <= value && value <= this.to;
		} catch(e) {
			LOGGER.strongWarning(e);
			return false;
		}
	}
}

export class DateEntry {
	public static readonly WEEKEND: WeekendDateEntry = new WeekendDateEntry();

	private constructor() {}

	public static point(target: PlainDate): PointDateEntry {
		return new PointDateEntry(target);
	}

	public static span(from: PlainDate, to: PlainDate): SpanDateEntry {
		return new SpanDateEntry(from, to);
	}
}