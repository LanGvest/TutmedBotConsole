import fs from "fs";
import {AppointmentDate, Employee, Institution} from "../utils/types";
import Api from "../utils/api";
import Settings from "../../settings";
import Logger, {getLogger} from "../utils/logger";
import {buildHashCode} from "../utils/builders";
import Registry from "../utils/registry";
import {getCorrectWord} from "../utils/helpers";

const logger = getLogger();

const intervals: Intervals = {};
const attempts: Attempts = {};
const prevResultCodes: PrevResultCodes = {};

interface Attempts {
	[code: number]: number
}

interface Intervals {
	[code: number]: number
}

interface PrevResultCodes {
	[code: number]: number
}

interface AppointmentDateInfo {
	date: string
	type: string
	amount: number
	times: Array<string>
}

interface GetDateInfoProps {
	employee: Employee
	date: AppointmentDate
}

async function getAppointmentDateInfo({employee, date}: GetDateInfoProps): Promise<AppointmentDateInfo> {
	const times = await Api.getTimes({
		employee,
		date
	});
	return {
		date: date.value,
		type: date.type.value,
		amount: times.length,
		times: times.map(time => time.value)
	};
}

function stringToPath(value: string): string {
	return value
		.replace(/[^\d№а-яёa-z-]/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function getResultDirPath(employee: Employee): string {
	const institution: string = stringToPath(employee.institution.name);
	const name: string = stringToPath(employee.name);
	if(!Settings.AUDIT.GROUP_BY_CATEGORY) return `${Settings.AUDIT.OUTPUT_DIR}/${institution}/${name}`;
	const category: string = stringToPath(employee.category.name);
	return `${Settings.AUDIT.OUTPUT_DIR}/${institution}/${category}/${name}`;
}

function createDirectories(resident: Institution, employees: Array<Employee>): void {
	for(const employee of employees) {
		const path: string = getResultDirPath(employee);
		if(!fs.existsSync(path)) {
			logger.info(`Создание директории: ${path}`);
			fs.mkdirSync(path, {
				recursive: true
			});
		}
	}
}

interface WriteResultProps {
	employee: Employee,
	result: Array<AppointmentDateInfo>
}

function writeResult({employee, result}: WriteResultProps): Promise<void> {
	return new Promise((resolve, reject) => {
		const date = new Date();
		const y: string = date.getFullYear().toString().padStart(4, "0");
		const M: string = (date.getMonth() + 1).toString().padStart(2, "0");
		const d: string = date.getDate().toString().padStart(2, "0");
		const H: string = date.getHours().toString().padStart(2, "0");
		const m: string = date.getMinutes().toString().padStart(2, "0");
		const s: string = date.getSeconds().toString().padStart(2, "0");
		fs.writeFile(`${getResultDirPath(employee)}/${y}-${M}-${d}-${H}-${m}-${s}.json`, JSON.stringify({
			attempt: attempts[employee.code],
			milliseconds: Math.floor(performance.now()),
			name: employee.name,
			details: employee.details,
			category: employee.category.name,
			timestamp: date.getTime(),
			date: `${d}.${M}.${y} ${H}:${m}:${s}`,
			result
		}, null, "\t"), err => {
			if(err) return reject(err);
			resolve();
		});
	})
}

interface AuditEmployee {
	employee: Employee
}

async function auditEmployee({employee}: AuditEmployee): Promise<void> {
	if(!attempts[employee.code]) attempts[employee.code] = 1;
	else attempts[employee.code]++;
	const dates = await Api.getDates({
		employee
	});
	if(!dates.length) {
		logger.failure(`${employee.name} - Попытка ${attempts[employee.code]} (нет приёма).`);
		intervals[employee.code] = Settings.AUDIT.INTERVAL;
		return;
	}
	intervals[employee.code] = Settings.AUDIT.INTERVAL_ON_SUCCESS;
	const result: Array<AppointmentDateInfo> = await Promise.all(dates.map(date => getAppointmentDateInfo({
		employee,
		date
	})));
	let timesCount: number = 0;
	for(const item of result) timesCount += item.amount;
	logger.success(`${employee.name} - Попытка ${attempts[employee.code]} (${getCorrectWord("доступно", "доступна", "доступно", timesCount)} ${timesCount} ${getCorrectWord("записей", "запись", "записи", timesCount)} на приём).`);
	const stringifiedResultCode: number = JSON.stringify(result).getHashCode();
	if(prevResultCodes[employee.code] === stringifiedResultCode) return;
	prevResultCodes[employee.code] = stringifiedResultCode;
	await writeResult({
		employee,
		result
	});
}

function exec(props: AuditEmployee): void {
	const startTime: number = Math.floor(performance.now());
	auditEmployee(props).then(() => {
		const completeTime: number = Math.floor(performance.now());
		const timeDiff: number = completeTime - startTime;
		setTimeout(exec.bind(null, props), timeDiff >= intervals[props.employee.code] ? 0 : intervals[props.employee.code] - timeDiff);
	});
}

export async function startAudit(): Promise<void> {
	const institution = await Registry.getInstitutionByName({
		sourceUrl: "https://tutmed.by/region/gm/poli",
		name: "ГУЗ Гомельская городская клиническая поликлиника №5 им. С.В.Голуховой"
	});
	if(!institution) {
		logger.error("not fount institution");
		return;
	}
	let employees: Array<Employee> = await Api.getEmployees({
		institution
	});
	// if(Settings.AUDIT.EMPLOYEES !== "*") {
	// 	const availableCodes: Array<number> = Settings.AUDIT.EMPLOYEES.map(name => buildHashCode(name));
	// 	employees = employees.filter(employee => ~availableCodes.indexOf(employee.code));
	// }
	const code: number = buildHashCode("врач общей практики")
	// employees = employees.filter((employee, index) => employee.category.code === code);
	createDirectories(institution, employees);
	for(const employee of employees) exec({
		employee
	});
}