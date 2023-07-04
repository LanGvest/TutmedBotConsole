// noinspection JSUnusedGlobalSymbols

import {Nullable} from "./helpers";

export type TimeUnit = "D" | "d" | "M" | "Y" | "H" | "h" | "m" | "s" | "S";

export enum Month {
	JANUARY = 1,
	FEBRUARY,
	MARCH,
	APRIL,
	MAY,
	JUNE,
	JULY,
	AUGUST,
	SEPTEMBER,
	OCTOBER,
	NOVEMBER,
	DECEMBER
}

interface TimeUnitObject {
	get: (that: Time) => number
	set: (that: Time, value: number) => void
	add: (that: Time, amount: number) => void
	byMs: (ms: number) => number
	getLast: (that: Time) => number
	getFirst: (that: Time) => number
	next: Nullable<TimeUnit>
}

type TimeUnitObjects = {
	[timeUnit in TimeUnit]: TimeUnitObject
}

const timeUnitObjects: TimeUnitObjects = {
	D: {
		get: that => that.getDayOfWeek(),
		set: (that, value) => that.setDay(value),
		add: (that, amount) => that.setDay(that.getDay() + amount),
		byMs: ms => Math.floor(ms / 24 / 60 / 60 / 1000),
		getFirst: () => 1,
		getLast: that => new Date(that.getYear(), that.getMonth(), 0).getDate(),
		next: "H"
	},
	d: {
		get: that => that.getDay(),
		set: (that, value) => that.setDay(value),
		add: (that, amount) => that.setDay(that.getDay() + amount),
		byMs: ms => Math.floor(ms / 24 / 60 / 60 / 1000),
		getFirst: () => 1,
		getLast: that => new Date(that.getYear(), that.getMonth(), 0).getDate(),
		next: "H"
	},
	M: {
		get: that => that.getMonth(),
		set: (that, value) => that.setMonth(value),
		add: (that, amount) => that.setMonth(that.getMonth() + amount),
		byMs: ms => Math.floor(ms / (365 / 12) / 24 / 60 / 60 / 1000),
		getFirst: () => 1,
		getLast: () => 12,
		next: "d"
	},
	Y: {
		get: that => that.getYear(),
		set: (that, value) => that.setYear(value),
		add: (that, amount) => that.setYear(that.getYear() + amount),
		byMs: ms => Math.floor(ms / 365 / 24 / 60 / 60 / 1000),
		getFirst: () => 1,
		getLast: that => that.getYear(),
		next: "M"
	},
	H: {
		get: that => that.getHours(),
		set: (that, value) => that.setHours(value),
		add: (that, amount) => that.setHours(that.getHours() + amount),
		byMs: ms => Math.floor(ms / 60 / 60 / 1000),
		getFirst: () => 0,
		getLast: () => 23,
		next: "m"
	},
	h: {
		get: that => that.getHoursAMPM(),
		set: (that, value) => that.setHours(value),
		add: (that, amount) => that.setHours(that.getHours() + amount),
		byMs: ms => Math.floor(ms / 60 / 60 / 1000),
		getFirst: () => 0,
		getLast: () => 23,
		next: "m"
	},
	m: {
		get: that => that.getMinutes(),
		set: (that, value) => that.setMinutes(value),
		add: (that, amount) => that.setMinutes(that.getMinutes() + amount),
		byMs: ms => Math.floor(ms / 60 / 1000),
		getFirst: () => 0,
		getLast: () => 59,
		next: "s"
	},
	s: {
		get: that => that.getSeconds(),
		set: (that, value) => that.setSeconds(value),
		add: (that, amount) => that.setSeconds(that.getSeconds() + amount),
		byMs: ms => Math.floor(ms / 1000),
		getFirst: () => 0,
		getLast: () => 59,
		next: "S"
	},
	S: {
		get: that => that.getMilliseconds(),
		set: (that, value) => that.setMilliseconds(value),
		add: (that, amount) => that.setMilliseconds(that.getMilliseconds() + amount),
		byMs: ms => Math.floor(ms),
		getFirst: () => 0,
		getLast: () => 999,
		next: null
	}
};

export default class Time {
	private date: Date;

	constructor(ms?: number) {
		this.date = typeof ms === "number" ? new Date(ms): new Date();
	}

	getTimestamp(): number {
		return this.date.getTime();
	}

	setTimestamp(timestamp: number): Time {
		this.date.setTime(timestamp);
		return this;
	}

	getYear(): number {
		return this.date.getFullYear();
	}

	setYear(year: number): Time {
		this.date.setFullYear(year);
		return this;
	}

	getMonth(): number | Month {
		return this.date.getMonth() + 1;
	}

	setMonth(month: number | Month): Time {
		this.date.setMonth(month - 1);
		return this;
	}

	getDay(): number {
		return this.date.getDate();
	}

	setDay(day: number): Time {
		this.date.setDate(day);
		return this;
	}

	getDayOfWeek(): number {
		const dayOfWeek = this.date.getDay();
		return dayOfWeek === 0 ? 7 : dayOfWeek;
	}

	getMilliseconds(): number {
		return this.date.getMilliseconds();
	}

	setMilliseconds(milliseconds: number): Time {
		this.date.setMilliseconds(milliseconds);
		return this;
	}

	getHours(): number {
		return this.date.getHours();
	}

	setHours(hours: number): Time {
		this.date.setHours(hours);
		return this;
	}

	getHoursAMPM(): number {
		let hours = this.getHours();
		return  (hours %= 12) ? hours : 12;
	}

	getMinutes(): number {
		return this.date.getMinutes();
	}

	setMinutes(minutes: number): Time {
		this.date.setMinutes(minutes);
		return this;
	}

	getSeconds(): number {
		return this.date.getSeconds();
	}

	setSeconds(seconds: number): Time {
		this.date.setSeconds(seconds);
		return this;
	}

	format(template: string): string {
		const regexp = new RegExp(Object.keys(timeUnitObjects).map(timeUnit => timeUnit + "+").join("|"), "g");
		return template.replace(regexp, match => {
			const timeUnit = match[0] as TimeUnit;
			return timeUnitObjects[timeUnit].get(this).toString().padStart(match.length, "0");
		});
	}

	plus(amount: number, timeUnit: TimeUnit): Time {
		timeUnitObjects[timeUnit].add(this, amount);
		return this;
	}

	minus(amount: number, timeUnit: TimeUnit): Time {
		timeUnitObjects[timeUnit].add(this, amount * -1);
		return this;
	}

	valueOf(): number {
		return this.date.valueOf();
	}

	clone(): Time {
		return new Time(this.date.valueOf());
	}

	startOf(timeUnit: TimeUnit): Time {
		let nextTimeUnit = timeUnitObjects[timeUnit].next;
		while(nextTimeUnit) {
			const nextTimeUnitObject: TimeUnitObject = timeUnitObjects[nextTimeUnit];
			nextTimeUnitObject.set(this, nextTimeUnitObject.getFirst(this));
			nextTimeUnit = nextTimeUnitObject.next;
		}
		return this;
	}

	endOf(timeUnit: TimeUnit): Time {
		let nextTimeUnit = timeUnitObjects[timeUnit].next;
		while(nextTimeUnit) {
			const nextTimeUnitObject: TimeUnitObject = timeUnitObjects[nextTimeUnit];
			nextTimeUnitObject.set(this, nextTimeUnitObject.getLast(this));
			nextTimeUnit = nextTimeUnitObject.next;
		}
		return this;
	}

	diff(time: Time, timeUnit: TimeUnit): number {
		return timeUnitObjects[timeUnit].byMs(this.getMilliseconds() - time.getMilliseconds());
	}
}

export function getTime(ms?: number): Time {
	return new Time(ms);
}

export function msToS(ms: number): number {
	return Math.trunc(ms / 1000);
}

export function sToMs(s: number): number {
	return s * 1000;
}