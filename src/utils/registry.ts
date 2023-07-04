// noinspection JSUnusedLocalSymbols,JSUnusedGlobalSymbols

import {
	AppointmentTypeCodes,
	AppointmentTypes,
	Category,
	Employee,
	EmployeesCache,
	EmployeesCacheItem,
	FullName,
	Institution,
	InstitutionsCache,
	InstitutionsCacheItem,
	InstitutionsSourceUrl,
	Patient
} from "./types";
import {getRandomHash, HashLength, HashSymbols, Nullable} from "./helpers";
import {buildAppointmentStrategiesStack, buildAppointmentTypeCodes, buildHashCode, buildInstitutionHashCode} from "./builders";
import AppointmentStrategies from "../../appointment.strategies";
import Api from "./api";
import {AppointmentStrategiesStackItem} from "./strategies";
import Settings from "../../settings";
import {getLogger} from "./logger";

const LOGGER = getLogger();

interface GetPatientByNameProps {
	name: FullName
}

interface GetInstitutionsProps {
	sourceUrl: InstitutionsSourceUrl
}

interface GetInstitutionByNameProps {
	sourceUrl: InstitutionsSourceUrl
	name: string
}

interface GetEmployeesProps {
	institution: Institution
}

interface GetEmployeesByCategoryProps {
	institution: Institution
	category: Category
}

interface GetEmployeeByName {
	institution: Institution
	name: string
}

export default class Registry {
	static #patients: Nullable<Array<Patient>> = null;
	static #appointmentStrategyStack: Nullable<Array<AppointmentStrategiesStackItem>> = null;
	static #institutionsCache: InstitutionsCache = {};
	static #employeesCache: EmployeesCache = {};
	static #ids: Array<string> = [];
	static #appointmentTypeCodes: Nullable<AppointmentTypeCodes> = null;
	static #appointmentTypes: AppointmentTypes = {
		"Приём через интернет": [
			"Предварительная запись (регистратура/интернет)",
			"Запись в день приёма через интернет",
			"Запись в день приёма",
			"Приём по предварительной записи",
			"Предварительная запись через интернет"
		],
		"Приём беременных через интернет": [
			"Приём беременных по записи через интернет",
			"Приём беременных"
		]
	};

	private constructor() {}

	public static async getPatients(): Promise<Array<Patient>> {
		if(Registry.#patients) return Registry.#patients;
		return Registry.#patients = await Api.getPatients();
	}

	public static async getPatientByName({name}: GetPatientByNameProps): Promise<Nullable<Patient>> {
		const patients: Array<Patient> = await Registry.getPatients();
		const code: number = buildHashCode(name);
		return patients.find(patient => buildHashCode(`${patient.lastName} ${patient.firstName} ${patient.middleName}`) === code) || null;
	}

	public static async getAdmin(): Promise<Nullable<Patient>> {
		if(!Settings.ADMIN) return null;
		const reportReceiver = await Registry.getPatientByName({
			name: Settings.ADMIN
		});
		if(!reportReceiver) {
			LOGGER.strongWarning("Администратор не найден!");
		} else if(!reportReceiver.viberUid) {
			LOGGER.strongWarning("Администратор не авторизован!");
		}
		return reportReceiver;
	}

	public static async getInstitutions({sourceUrl}: GetInstitutionsProps): Promise<Array<Institution>> {
		const cache: Nullable<InstitutionsCacheItem> = Registry.#institutionsCache[sourceUrl] || null;
		if(cache) {
			const now: number = new Date().getTime();
			const isActual: boolean = now - cache.lastUpdate <= Settings.INSTITUTIONS_UPDATE_INTERVAL;
			if(isActual) return cache.value;
		}
		const value: Array<Institution> = await Api.getInstitutions({
			sourceUrl
		});
		Registry.#institutionsCache[sourceUrl] = {
			lastUpdate: new Date().getTime(),
			value
		}
		return value;
	}

	public static async getInstitutionByName({sourceUrl, name}: GetInstitutionByNameProps): Promise<Nullable<Institution>> {
		const institutions: Array<Institution> = await Registry.getInstitutions({
			sourceUrl
		});
		const code: number = buildInstitutionHashCode(name);
		return institutions.find(institution => institution.code === code) || null;
	}

	public static async getAppointmentStrategyStack(): Promise<Array<AppointmentStrategiesStackItem>> {
		if(Registry.#appointmentStrategyStack) return Registry.#appointmentStrategyStack;
		return Registry.#appointmentStrategyStack = await buildAppointmentStrategiesStack({
			view: AppointmentStrategies
		});
	}

	public static async getEmployees({institution}: GetEmployeesProps): Promise<Array<Employee>> {
		const cache: Nullable<EmployeesCacheItem> = Registry.#employeesCache[institution.id] || null;
		if(cache) {
			const now: number = new Date().getTime();
			const isActual: boolean = now - cache.lastUpdate <= Settings.EMPLOYEES_UPDATE_INTERVAL;
			if(isActual) return cache.value;
		}
		const value: Array<Employee> = await Api.getEmployees({
			institution
		});
		Registry.#employeesCache[institution.id] = {
			lastUpdate: new Date().getTime(),
			value
		}
		return value;
	}

	public static async getEmployeesByCategory({institution, category}: GetEmployeesByCategoryProps): Promise<Array<Employee>> {
		const employees: Array<Employee> = await Registry.getEmployees({
			institution
		});
		return employees.filter(employee => employee.category.code === category.code);
	}

	public static async getEmployeeByName({institution, name}: GetEmployeeByName): Promise<Nullable<Employee>> {
		const employees: Array<Employee> = await Registry.getEmployees({
			institution
		});
		const code: number = buildHashCode(name);
		return employees.find(employee => employee.code === code) || null;
	}

	public static getAppointmentTypes(): AppointmentTypes {
		return Registry.#appointmentTypes;
	}

	public static getAppointmentTypeCodes(): AppointmentTypeCodes {
		if(Registry.#appointmentTypeCodes) return Registry.#appointmentTypeCodes;
		return Registry.#appointmentTypeCodes = buildAppointmentTypeCodes({
			view: Registry.getAppointmentTypes()
		});
	}

	public static generateId(): string {
		let id: string;
		do {
			id = getRandomHash(HashLength.ID, HashSymbols.ID);
		} while(~Registry.#ids.indexOf(id));
		Registry.#ids.push(id);
		return id;
	}
}