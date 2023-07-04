import {Nullable} from "./helpers";

const petrovich = require("petrovich");

export enum PersonNameGender {
	MALE = "male",
	FEMALE = "female",
	ANDROGYNOUS = "androgynous"
}

// noinspection JSUnusedGlobalSymbols
export enum PersonNameCase {
	NOMINATIVE = "nominative",
	GENITIVE = "genitive",
	DATIVE = "dative",
	ACCUSATIVE = "accusative",
	INSTRUMENTAL = "instrumental",
	PREPOSITIONAL = "prepositional"
}

interface PersonNameWithFirstName {
	gender: PersonNameGender
	firstName: string
	middleName?: string
	lastName?: string
}

interface PersonNameWithMiddleName {
	gender?: PersonNameGender
	firstName?: string
	middleName: string
	lastName?: string
}

interface PersonNameWithLastName {
	gender: PersonNameGender
	firstName?: string
	middleName?: string
	lastName: string
}

export interface RecasedPersonName {
	gender: PersonNameGender
	firstName: Nullable<string>
	middleName: Nullable<string>
	lastName: Nullable<string>
}

interface NativeRecasedPersonName {
	gender: PersonNameGender
	first?: string
	middle?: string
	last?: string
}

export type PersonName = PersonNameWithFirstName | PersonNameWithMiddleName | PersonNameWithLastName;

/**
 * <code>nominative</code> - именительный (кто? что?) <br/>
 * <code>genitive</code> - родительный (кого? чего?) <br/>
 * <code>dative</code> - дательный (кому? чему?) <br/>
 * <code>accusative</code> - винительный (кого? что?) <br/>
 * <code>instrumental</code> - творительный (кем? чем?) <br/>
 * <code>prepositional</code> - предложный (о ком? о чем?)
 */
export function recasePersonName(name: PersonName, nameCase: PersonNameCase): RecasedPersonName {
	const result: NativeRecasedPersonName = petrovich({
		gender: name.gender,
		first: name.firstName,
		middle: name.middleName,
		last: name.lastName
	}, nameCase);
	return {
		gender: result.gender,
		firstName: result.first || null,
		middleName: result.middle || null,
		lastName: result.last || null
	};
}

export function getPersonNameGenderByLastName(lastName: string): PersonNameGender {
	if(/(ова|ева|ина|ая|яя|екая|цкая)$/i.test(lastName)) return PersonNameGender.FEMALE;
	if(/(ов|ев|ин|ын|ой|цкий|ский|цкой|ской)$/i.test(lastName)) return PersonNameGender.MALE;
	return PersonNameGender.ANDROGYNOUS;
}