// noinspection JSUnusedGlobalSymbols

import {getTime} from "./time";
import {LastOf} from "./helpers";
import {LoggerName} from "../enums/loggerName.enum";

export enum ConsoleStyle {
	RESET,
	BOLD,
	UNDERSCORE = 4,
	FG_BLACK = 30,
	FG_RED,
	FG_GREEN,
	FG_YELLOW,
	FG_BLUE,
	FG_MAGENTA,
	FG_CYAN,
	FG_WHITE,
	BG_BLACK = 40,
	BG_RED,
	BG_GREEN,
	BG_YELLOW,
	BG_BLUE,
	BG_MAGENTA,
	BG_CYAN,
	BG_WHITE,
	FG_GRAY = 90,
	FG_BRIGHT_RED,
	FG_BRIGHT_GREEN,
	FG_BRIGHT_YELLOW,
	FG_BRIGHT_BLUE,
	FG_BRIGHT_MAGENTA,
	FG_BRIGHT_CYAN,
	FG_BRIGHT_WHITE,
	BG_GRAY = 100,
	BG_BRIGHT_RED,
	BG_BRIGHT_GREEN,
	BG_BRIGHT_YELLOW,
	BG_BRIGHT_BLUE,
	BG_BRIGHT_MAGENTA,
	BG_BRIGHT_CYAN,
	BG_BRIGHT_WHITE
}

const stampLabels = [
	"log",
	"info",
	"audit",
	"warn",
	"error",
	"wait",
	"succ",
	"fail",
	"help"
] as const;

const stampLabelMaxLength: number = stampLabels.reduce((max, label) => label.length > max ? label.length : max, 0);

type StampLabel = typeof stampLabels[number];

export default class Logger {
	private readonly name: string;
	private enabled: boolean = true;

	constructor(name: LoggerName | string = LoggerName.DEFAULT) {
		this.name = name;
	}

	private static buildStyleMark(index: ConsoleStyle | number): string {
		return `\x1b[${index}m`;
	}

	public static resetStyle(): string {
		return Logger.buildStyleMark(ConsoleStyle.RESET);
	}

	public static inlineStyle(...styles: ConsoleStyle[]): string {
		if(!styles.length) return Logger.resetStyle();
		return styles.map(index => Logger.buildStyleMark(index)).join("");
	}

	private buildStamp(label: StampLabel, ...styles: ConsoleStyle[]): string {
		return (
			Logger.inlineStyle(ConsoleStyle.FG_MAGENTA) + `[${this.getName()}]` + Logger.resetStyle()
			+ " " + Logger.inlineStyle(ConsoleStyle.FG_GRAY) + getTime().format("YYYY-MM-dd HH:mm:ss.SSS") + Logger.resetStyle()
			+ " " + Logger.inlineStyle(...styles) + label.toUpperCase().padStart(stampLabelMaxLength, " ") + Logger.resetStyle()
		);
	}

	public disable(): this {
		this.enabled = false;
		return this;
	}

	public enable(): this {
		this.enabled = true;
		return this;
	}

	public getName(): string {
		return this.name;
	}

	public clear(): void {
		console.clear();
	}

	public log<T extends any[]>(...values: T): LastOf<T> {
		if(this.enabled) console.log(this.buildStamp("log", ConsoleStyle.FG_GRAY), ...values);
		return values[-1];
	}

	public info<T extends any[]>(...values: T): LastOf<T> {
		if(this.enabled) console.log(this.buildStamp("info", ConsoleStyle.FG_BLUE), ...values);
		return values[-1];
	}

	public audit<T extends any[]>(...values: T): LastOf<T> {
		if(this.enabled) console.log(this.buildStamp("audit", ConsoleStyle.FG_GREEN), ...values);
		return values[-1];
	}

	public warning<T extends any[]>(...values: T): LastOf<T> {
		if(this.enabled) console.log(this.buildStamp("warn", ConsoleStyle.FG_YELLOW), ...values);
		return values[-1];
	}

	public strongWarning<T extends any[]>(...values: T): LastOf<T> {
		if(this.enabled) console.log(this.buildStamp("warn", ConsoleStyle.FG_RED), ...values);
		return values[-1];
	}

	public error<T extends any[]>(...values: T): LastOf<T> {
		if(this.enabled) console.log(this.buildStamp("error", ConsoleStyle.FG_RED), ...values);
		return values[-1];
	}

	public wait<T extends any[]>(...values: T): LastOf<T> {
		if(this.enabled) console.log(this.buildStamp("wait", ConsoleStyle.FG_GRAY), ...values);
		return values[-1];
	}

	public success<T extends any[]>(...values: T): LastOf<T> {
		if(this.enabled) console.log(this.buildStamp("succ", ConsoleStyle.FG_GREEN), ...values);
		return values[-1];
	}

	public failure<T extends any[]>(...values: T): LastOf<T> {
		if(this.enabled) console.log(this.buildStamp("fail", ConsoleStyle.FG_RED), ...values);
		return values[-1];
	}

	public help<T extends any[]>(...values: T): LastOf<T> {
		if(this.enabled) console.log(this.buildStamp("help", ConsoleStyle.FG_BLACK, ConsoleStyle.BG_YELLOW), ...values);
		return values[-1];
	}
}

interface LoggerByName {
	[name: string]: Logger
}

const loggerByName: LoggerByName = {};

export function getLogger(name: LoggerName | string = LoggerName.DEFAULT): Logger {
	if(loggerByName[name]) return loggerByName[name];
	return loggerByName[name] = new Logger(name);
}