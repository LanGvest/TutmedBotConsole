// noinspection JSUnusedGlobalSymbols

declare global {
	interface String {
		ucFirst(): string
		getHashCode(): number
	}
	interface Number {
		pad(length: number): string
	}
}

String.prototype.ucFirst = function(): string {
	return this && this[0].toUpperCase() + this.substring(1);
};

String.prototype.getHashCode = function(): number {
	let hash: number = 0, char: number, i: number;
	if(this.length === 0) return hash;
	for(i = 0; i < this.length; i++) {
		char = this.charCodeAt(i);
		hash = ((hash<<5)-hash)+char;
		hash &= hash;
	}
	return hash;
};

Number.prototype.pad = function(length: number): string {
	return this.toString().padStart(length, "0");
};

export {};