// noinspection JSUnusedLocalSymbols,JSUnusedGlobalSymbols

import {DirectionalEntry, Matchable} from "../utils/entries";
import Logger, {getLogger} from "../utils/logger";
import {LoggerName} from "../enums/loggerName.enum";

const logger = getLogger(LoggerName.ENTRIES);

export type AnyTimeEntry = PointTimeEntry | SpanTimeEntry;
export type PlainTime = `${number}:${number}`;

function validatePlainTime(value: string): PlainTime | never {
	if(!/^\d{1,2}:\d{1,2}$/.test(value)) throw new TypeError(`Invalid plain time syntax '${value}'.`);
	const items: Array<number> = value.split(":").map(item => Number(item));
	const H: number = items[0];
	const m: number = items[1];
	if(H < 0 || H > 23) throw new RangeError(`Invalid hour '${H}' in plain time '${value}'.`);
	if(m < 0 || m > 59) throw new RangeError(`Invalid minute '${m}' in plain time '${value}'.`);
	return `${H.pad(2)}:${m.pad(2)}` as PlainTime;
}

class PointTimeEntry implements Matchable {
	private readonly target: PlainTime;

	public constructor(target: PlainTime) {
		this.target = validatePlainTime(target);
	}

	public matches(value: string): boolean {
		try {
			value = validatePlainTime(value);
			return this.target === value;
		} catch(e) {
			logger.strongWarning(e);
			return false;
		}
	}
}

class SpanTimeEntry extends DirectionalEntry implements Matchable {
	private readonly from: PlainTime;
	private readonly to: PlainTime;

	public constructor(from: PlainTime, to: PlainTime) {
		super();
		this.from = validatePlainTime(from);
		this.to = validatePlainTime(to);
		if(this.from >= this.to) throw new RangeError(`Invalid plain time span range. 'From' plain time '${from}' cannot be more than or equal to 'to' plain time '${to}'.`);
	}

	public matches(value: string): boolean {
		try {
			value = validatePlainTime(value);
			return this.from <= value && value <= this.to;
		} catch(e) {
			logger.strongWarning(e);
			return false;
		}
	}
}

export class TimeEntry {
	private constructor() {}

	public static point(target: PlainTime): PointTimeEntry | never {
		return new PointTimeEntry(target);
	}

	public static span(from: PlainTime, to: PlainTime): SpanTimeEntry | never {
		return new SpanTimeEntry(from, to);
	}
}