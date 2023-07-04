import {spawn} from "child_process";

export type Nullable<T> = T | null;
export type LastOf<T extends any[]> = T extends [...any[], infer R] ? R : never;

export enum HttpStatus {
	TOO_MANY_REQUESTS = 429
}

export enum HashLength {
	ID = 10
}

export enum HashSymbols {
	STANDARD = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
	ID = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"
}

export function sleep(ms: number): Promise<void> {
	return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export function getCorrectWord(_0: string, _1: string, _2: string, amount: number) {
	const str: string = String(amount);
	if(str.length > 1) {
		switch(str.substring(str.length-2)) {
			case "11":
			case "12":
			case "13":
			case "14": return _0;
		}
	}
	switch(str.substring(str.length-1)) {
		case "1": return _1;
		case "2":
		case "3":
		case "4": return _2;
		default: return _0;
	}
}

export function getRandomInt(min: number, max: number): number {
	if(max < min) throw RangeError(`The max value must be greater than or equal to the min value. Your max value is ${max} while the min value is ${min}`);
	return ~~(Math.random()*(1+max-min)+min);
}

export function getRandomHash(length: HashLength | number, symbols: HashSymbols | string = HashSymbols.STANDARD): string {
	if(length < 0) throw RangeError(`The hash length can not be negative. Your hash length is ${length}.`);
	let value: string = "";
	let i: number;
	for(i = 0; i < length; i++) value += symbols[getRandomInt(0, symbols.length-1)];
	return value;
}

interface ShutdownProps {
	timeout?: number
	force?: boolean
	message?: string
}

export function shutdown({timeout, force = false, message}: ShutdownProps): void {
	const args: Array<string> = ["/s"];
	if(timeout) {
		args.push("/t");
		args.push(timeout.toString());
	}
	if(force) {
		args.push("/f");
	}
	if(message) {
		args.push("/c");
		args.push(message);
	}
	spawn("shutdown", args);
}

export function exitProcess(code: number = 0): never {
	// noinspection TypeScriptValidateJSTypes
	process.exit(code);
}

interface DurationOptions {
	ms: number
	deep?: number
	withMilliseconds?: boolean,
	short?: boolean
}

export function getDurationStamp({ms, deep = 2, withMilliseconds = false, short = false}: DurationOptions): string {
	if(deep <= 0) return "";
	if(ms < 0) ms *= -1;
	if(!ms) {
		if(withMilliseconds) return short ? "0 мс." : "0 миллисекунд";
		return short ? "0 сек." : "0 секунд";
	}
	const arr: string[] = [];
	const days: number = Math.floor(ms / (1000 * 60 * 60 * 24));
	if(days) arr.push(days + " " + (short ? "д." : getCorrectWord("дней", "день", "дня", days)));
	if(arr.length === deep) return arr.join(" ");
	const hours: number = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	if(hours) arr.push(hours + " " + (short ? "ч." : getCorrectWord("часов", "час", "часа", hours)));
	if(arr.length === deep) return arr.join(" ");
	const minutes: number = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
	if(minutes) arr.push(minutes + " " + (short ? "мин." : getCorrectWord("минут", "минута", "минуты", minutes)));
	if(arr.length === deep) return arr.join(" ");
	const seconds: number = Math.floor((ms % (1000 * 60)) / 1000);
	if(seconds) arr.push(seconds + " " + (short ? "сек." : getCorrectWord("секунд", "секунда", "секунды", seconds)));
	if(arr.length === deep) return arr.join(" ");
	if(withMilliseconds) {
		const milliseconds: number = ms % 1000;
		if(milliseconds) arr.push(milliseconds + " " + (short ? "мс." : getCorrectWord("миллисекунд", "миллисекунда", "миллисекунды", milliseconds)));
		if(arr.length === deep) return arr.join(" ");
	}
	return arr.join(" ");
}