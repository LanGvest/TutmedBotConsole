import {Nullable} from "./helpers";
import {AnyEmployeeEntry} from "../entries/employee.entry";
import {AnyDateEntry} from "../entries/date.entry";
import {AnyTimeEntry} from "../entries/time.entry";

export type StartupMode = "appointment" | "audit";

export type UnsafeStartupMode = StartupMode | string;

export type AnyEntry = AnyEmployeeEntry | AnyDateEntry | AnyTimeEntry;

export type AppointmentTypeCategory = "Приём через интернет" | "Приём беременных через интернет";

export type AppointmentTypeValue = string
	| "Предварительная запись (регистратура/интернет)"
	| "Запись в день приёма через интернет"
	| "Запись в день приёма"
	| "Приём по предварительной записи"
	| "Предварительная запись через интернет"
	| "Приём беременных"
	| "Приём беременных по записи через интернет"
	| "Платный приём по записи через интернет"
	| "Выдача заключений проф.осмотра"
	| "Выдача заключений ВЭК"
	| "Кольпоскопия (интернет)"
	| "Диспансеризация (регистратура/интернет)"
	| "Предварительная запись на диспансеризацию (регистратура/интернет)";

export type AppointmentTypes = {
	[category in AppointmentTypeCategory]: Array<AppointmentTypeValue>
}

export type AppointmentTypeCodes = {
	[category in AppointmentTypeCategory]: Array<number>
}

export interface AppointmentEntryRules<T> {
	strict: boolean
	prefer: Array<T>
	ignore: Array<T>
}

export interface AppointmentEntry {
	type: AppointmentTypeCategory | Array<AppointmentTypeCategory>
	employee: AppointmentEntryRules<AnyEmployeeEntry>
	date: AppointmentEntryRules<AnyDateEntry>
	time: AppointmentEntryRules<AnyTimeEntry>
}

export interface AppointmentEntries {
	[category: string]: Array<AppointmentEntry>
}

export type FullName = `${string} ${string} ${string}`;

export type InstitutionsSourceUrlProtocol = "http" | "https";

export type InstitutionsSourceUrlRegion = "br" | "gm" | "mg" | "mnsk";

export type InstitutionsSourceUrlType = "poli" | "bol" | "dis";

export type InstitutionsSourceUrl = `${InstitutionsSourceUrlProtocol}://tutmed.by/region/${InstitutionsSourceUrlRegion}/${InstitutionsSourceUrlType}`;

export interface Patient {
	uid: string
	phoneNumberBase: number
	viberUid: Nullable<string>
	firstName: string
	middleName: string
	lastName: string
	isFemale: boolean
	isViewer: boolean
	number: Nullable<number>
	pin: Nullable<number>
}

export type ContentBlock = TextContentBlock | EmployeeContentBlock;

export interface TextContentBlock {
	type: "text"
	value: string
}

export interface EmployeeContentBlock {
	type: "employee"
	id: string
	name: string
	details: string
}

export interface Employee {
	id: string
	lastName: string
	nameInitials: string
	name: string
	details: string
	code: number
	institution: Institution
	category: Category
}

export interface AppointmentType {
	id: string
	value: AppointmentTypeValue
	code: number
}

export interface AppointmentDate {
	id: string
	value: string
	type: AppointmentType
}

export interface AppointmentTime {
	id: string
	value: string
}

export interface Category {
	name: string
	code: number
}

export interface AppointmentStrategy {
	// Название нужного медучреждения.
	institution: string
	// Адрес источника медучреждений.
	source: InstitutionsSourceUrl
	// ФИО пациента.
	patient: FullName
	// Пользователи, которых также необходимо уведомить о совершении записи на приём
	notify: Array<FullName>
	// Точки входа автоматической записи на приём.
	entries: AppointmentEntries
}

export interface Settings {
	MODE: UnsafeStartupMode
	TOO_MANY_REQUESTS_TIMEOUT: number
	API_ERROR_TIMEOUT: number
	INSTITUTIONS_UPDATE_INTERVAL: number
	EMPLOYEES_UPDATE_INTERVAL: number
	SHOW_API_LOGS: boolean
	DEBUG: boolean
	ADMIN: Nullable<FullName>
	MAX_ERROR_REPORT_COUNT: number
	APPOINTMENT: {
		INTERVAL: number
		AUTO_COMPLETE_TIMEOUT: Nullable<number>
		SHUTDOWN_ON_COMPLETE: boolean
		SHUTDOWN_TIMEOUT: number
	}
	AUDIT: {
		INTERVAL: number
		INTERVAL_ON_SUCCESS: number
		OUTPUT_DIR: string
		GROUP_BY_CATEGORY: boolean
		AUTO_COMPLETE_TIMEOUT: Nullable<number>
		SHUTDOWN_ON_COMPLETE: boolean
		SHUTDOWN_TIMEOUT: number
	}
}

export interface Institution {
	id: string
	name: string
	defaultImageUrl: string
	siteUrl: Nullable<string>
	sourceUrl: InstitutionsSourceUrl
	onlineAppointmentSiteUrl: Nullable<string>
	code: number
}

export interface InstitutionsCacheItem {
	lastUpdate: number
	value: Array<Institution>
}

export interface InstitutionsCache {
	[url: string]: InstitutionsCacheItem
}

export interface EmployeesCacheItem {
	lastUpdate: number
	value: Array<Employee>
}

export interface EmployeesCache {
	[institutionId: string]: EmployeesCacheItem
}