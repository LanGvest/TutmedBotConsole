import Registry from "../utils/registry";
import {AppointmentEntriesStackItem, AppointmentStrategiesStackItem} from "../utils/strategies";
import {getLogger} from "../utils/logger";
import Settings from "../../settings";
import {AnyEntry, AppointmentDate, AppointmentEntry, AppointmentEntryRules, AppointmentTime, AppointmentTypeCategory, Category, Employee, Institution, Patient} from "../utils/types";
import {exitProcess, getCorrectWord, Nullable, shutdown, sleep} from "../utils/helpers";
import Api from "../utils/api";
import {Direction, DirectionalEntry} from "../utils/entries";
import {buildHashCode} from "../utils/builders";
import {getPersonNameGenderByLastName, PersonNameCase, recasePersonName} from "../utils/petrovich";
import {LoggerName} from "../enums/loggerName.enum";

const LOGGER = getLogger();
const DEBUG_LOGGER = getLogger(LoggerName.DEBUG);
const INTERVAL: number = Settings.APPOINTMENT.INTERVAL;

const attempts: Attempts = {};
let preventExecution: boolean = false;

interface Attempts {
	[key: string]: number
}

interface AppointmentTarget {
	employee: Employee
	date: AppointmentDate
	time: AppointmentTime
}

interface Candidate<T> {
	value: string
	ignored?: boolean
	ref: T
}

interface GetByRules<T> {
	input: Array<T>
	rules: AppointmentEntryRules<AnyEntry>
	skipList?: Array<string>
	getValue: (item: T) => string
	getIgnored?: (item: T) => boolean
}

function tryToGetByRules<T>({input, getValue, getIgnored, skipList, rules}: GetByRules<T>): Nullable<T> {
	if(preventExecution) return null;
	if(rules.strict && !rules.prefer.length) return null;
	const candidates: Array<Candidate<T>> = input.map(item => ({
		ref: item,
		value: getValue(item)
	}));
	for(const candidate of candidates) {
		if(skipList && skipList.length && ~skipList.indexOf(candidate.value)) {
			candidate.ignored = true;
			continue;
		}
		if(getIgnored && getIgnored(candidate.ref)) {
			candidate.ignored = true;
			continue;
		}
		for(const entry of rules.ignore) {
			if(entry.matches(candidate.value)) candidate.ignored = true;
		}
	}
	for(const entry of rules.prefer) {
		const candidatesCopy: Array<Candidate<T>> = [...candidates];
		if(entry instanceof DirectionalEntry && entry.getDirection() === Direction.DESC) {
			candidatesCopy.reverse();
		}
		for(const candidateCopy of candidatesCopy) {
			if(!candidateCopy.ignored && entry.matches(candidateCopy.value)) return candidateCopy.ref;
		}
	}
	if(rules.strict) return null;
	const notIgnoredCandidate: Nullable<Candidate<T>> = candidates.find(candidate => !candidate.ignored) || null;
	if(notIgnoredCandidate) return notIgnoredCandidate.ref;
	return null;
}

function shouldIgnoreDateByType(date: AppointmentDate, type: AppointmentTypeCategory | Array<AppointmentTypeCategory>): boolean {
	const code: number = buildHashCode(date.type.value);
	if(type instanceof Array) {
		for(const category of type) if(~Registry.getAppointmentTypeCodes()[category].indexOf(code)) return false;
		return true;
	} else {
		return !~Registry.getAppointmentTypeCodes()[type].indexOf(code);
	}
}

function getEmployeeValue(employee: Employee): string {
	return employee.name;
}

function getDateValue(date: AppointmentDate): string {
	return date.value;
}

function getTimeValue(time: AppointmentTime): string {
	return time.value;
}

interface TryToGetAppointmentTargetProps {
	institution: Institution
	patient: Patient
	category: Category
	employees: Array<Employee>
	entry: AppointmentEntry
}

async function tryToGetAnAppointmentTarget({employees, entry, institution, patient, category}: TryToGetAppointmentTargetProps): Promise<Nullable<AppointmentTarget>> {
	if(preventExecution) return null;
	if(entry.employee.strict && !entry.employee.prefer.length) {
		LOGGER.warning(`В стратегии записи на приём пациента '${patient.lastName} ${patient.firstName} ${patient.middleName}' к медработнику категории '${category.name}' в медучреждении '${institution.name}' обнаружен строгий режим выбора медработника без указания правил, по которым этот медработник может быть выбран. Это делает запись данного пациента на приём невозможным, а указанную стратегию – бессмысленной.`);
		LOGGER.help(`Укажите хотя бы одно правило по выбору медработника или уберите строгий режим, чтобы запись на приём стала возможной.`);
		return null;
	}
	if(entry.date.strict && !entry.date.prefer.length) {
		LOGGER.warning(`В стратегии записи на приём пациента '${patient.lastName} ${patient.firstName} ${patient.middleName}' к медработнику категории '${category.name}' в медучреждении '${institution.name}' обнаружен строгий режим выбора даты приёма без указания правил, по которым эта дата может быть выбрана. Это делает запись данного пациента на приём невозможным, а указанную стратегию – бессмысленной.`);
		LOGGER.help(`Укажите хотя бы одно правило по выбору даты приёма или уберите строгий режим, чтобы запись на приём стала возможной.`);
		return null;
	}
	if(entry.time.strict && !entry.time.prefer.length) {
		LOGGER.warning(`В стратегии записи на приём пациента '${patient.lastName} ${patient.firstName} ${patient.middleName}' к медработнику категории '${category.name}' в медучреждении '${institution.name}' обнаружен строгий режим выбора времени приёма без указания правил, по которым это время может быть выбрано. Это делает запись данного пациента на приём невозможным, а указанную стратегию – бессмысленной.`);
		LOGGER.help(`Укажите хотя бы одно правило по выбору времени приёма или уберите строгий режим, чтобы запись на приём стала возможной.`);
		return null;
	}
	const employeeSkipList: Array<string> = [];
	do {
		const employee = tryToGetByRules<Employee>({
			input: employees,
			skipList: employeeSkipList,
			rules: entry.employee,
			getValue: employee => getEmployeeValue(employee)
		});
		if(!employee) return null;
		const dates = await Api.getDates({
			employee
		});
		if(!dates.length) {
			employeeSkipList.push(getEmployeeValue(employee));
			continue;
		}
		const dateSkipList: Array<string> = [];
		do {
			const date = tryToGetByRules<AppointmentDate>({
				input: dates,
				skipList: dateSkipList,
				rules: entry.date,
				getValue: date => getDateValue(date),
				getIgnored: date => shouldIgnoreDateByType(date, entry.type)
			});
			if(!date) {
				employeeSkipList.push(getEmployeeValue(employee));
				break;
			}
			const times = await Api.getTimes({
				employee,
				date
			});
			if(!times.length) {
				dateSkipList.push(getDateValue(date));
				continue;
			}
			const time = tryToGetByRules<AppointmentTime>({
				input: times,
				rules: entry.time,
				getValue: time => getTimeValue(time)
			});
			if(!time) {
				dateSkipList.push(getDateValue(date));
				continue;
			}
			return {
				employee,
				date,
				time
			};
		} while(true);
	} while(true);
}

interface TryToMakeAnAppointmentProps {
	attemptKey: string
	institution: Institution
	patient: Patient
	notifyList: Array<Patient>
	entriesStackItem: AppointmentEntriesStackItem
}

async function tryToMakeAnAppointment({attemptKey, institution, patient, notifyList, entriesStackItem}: TryToMakeAnAppointmentProps): Promise<void> {
	if(preventExecution) return;
	if(!attempts[attemptKey]) attempts[attemptKey] = 1;
	else attempts[attemptKey]++;
	const category: Category = entriesStackItem.getCategory();
	const employees: Array<Employee> = await Registry.getEmployeesByCategory({
		institution,
		category
	});
	if(!employees.length) {
		LOGGER.warning(`В стратегии записи на приём пациента '${patient.lastName} ${patient.firstName} ${patient.middleName}' к медработнику категории '${category.name}' в медучреждении '${institution.name}' по указанной категории не найдено ни одного медработника. Это делает запись этого пациента на приём невозможным, а указанную стратегию – бессмысленной.`);
		LOGGER.help(`Возможно, в написании названия категории допущена ошибка, или такой категории не существует в этом медучреждении.`);
		LOGGER.help(`Все доступные категории медработников для медучреждения '${institution.name}' приведены на этом веб-сайте: ${institution.onlineAppointmentSiteUrl}.`);
		return;
	}
	let target: Nullable<AppointmentTarget> = null;
	for(const entry of entriesStackItem.getEntries()) {
		const possibleTarget = await tryToGetAnAppointmentTarget({
			institution,
			patient,
			category,
			employees,
			entry
		});
		if(possibleTarget) {
			target = possibleTarget;
			break;
		}
	}
	if(preventExecution) return;
	const genitivePatientName = recasePersonName(patient, PersonNameCase.GENITIVE);
	if(target) {
		const dativeEmployeeName = recasePersonName({
			gender: getPersonNameGenderByLastName(target.employee.lastName),
			lastName: target.employee.lastName
		}, PersonNameCase.DATIVE);
		LOGGER.success(`${category.name} для ${genitivePatientName.lastName} ${genitivePatientName.firstName![0]}.${genitivePatientName.middleName![0]}. – Попытка ${attempts[attemptKey]} (есть подходящий приём к ${dativeEmployeeName.lastName} ${target.employee.nameInitials} на ${target.date.value} в ${target.time.value})!`);
		const successfully = await Api.makeAnAppointment({
			patient,
			notifyList,
			attempt: attempts[attemptKey],
			employee: target.employee,
			date: target.date,
			time: target.time
		});
		if(successfully) entriesStackItem.complete();
	} else {
		LOGGER.failure(`${category.name} для ${genitivePatientName.lastName} ${genitivePatientName.firstName![0]}.${genitivePatientName.middleName![0]}. – Попытка ${attempts[attemptKey]} (нет подходящих приёмов).`);
	}
}

async function tryToExit(): Promise<void> {
	if(preventExecution) return;
	const strategyStack = await Registry.getAppointmentStrategyStack();
	for(const strategyStackItem of strategyStack) if(!strategyStackItem.isCompleted()) return;
	LOGGER.info("Все стратегии записи на приём были успешно выполнены!");
	LOGGER.info("Тутмед Бот успешно завершил свою работу.");
	await exit({
		shutdownMessage: "Все стратегии записи на приём были успешно выполнены!"
	});
}

async function autoExit(): Promise<void> {
	if(preventExecution) return;
	LOGGER.info("Работа Тутмед Бота была автоматически завершена, так как сработал таймер автоматического завершения работы.");
	await exit({
		shutdownMessage: "Сработал таймер автоматического завершения работы Тутмед бота!"
	});
}

interface ExitProcessProps {
	shutdownMessage?: string
}

async function exit({shutdownMessage}: ExitProcessProps = {}): Promise<void> {
	preventExecution = true;
	if(Settings.APPOINTMENT.SHUTDOWN_ON_COMPLETE) {
		let timeout: number = Math.floor(Settings.APPOINTMENT.SHUTDOWN_TIMEOUT / 1000);
		if(Settings.DEBUG) DEBUG_LOGGER.warning("Команда для выключения компьютера не будет выполнена, так как активирован режим отладки. Все действия являются симуляцией.");
		if(!Settings.DEBUG) shutdown({
			timeout,
			message: `${shutdownMessage ? shutdownMessage + " " : ""}Компьютер будет автоматически выключен по истечении ${timeout} ${getCorrectWord("секунд", "секунды", "секунд", timeout)}.`
		});
		do {
			LOGGER.strongWarning(`Компьютер будет автоматически выключен через ${timeout} ${getCorrectWord("секунд", "секунду", "секунды", timeout)}!`);
			await sleep(1000);
		} while(--timeout);
	}
	exitProcess();
}

interface ExecProps {
	strategyStackItem: AppointmentStrategiesStackItem
}

function exec(props: ExecProps): void {
	if(preventExecution) return;
	const startTime: number = Math.floor(performance.now());
	Promise.allSettled(props.strategyStackItem.getNotCompletedEntriesStack().map(entriesStackItem => tryToMakeAnAppointment({
		entriesStackItem,
		attemptKey: `${props.strategyStackItem.getId()}/${entriesStackItem.getId()}`,
		institution: props.strategyStackItem.getInstitution(),
		patient: props.strategyStackItem.getPatient(),
		notifyList: props.strategyStackItem.getNotifyList()
	}))).then(async () => {
		if(preventExecution) return;
		if(props.strategyStackItem.isCompleted()) return await tryToExit();
		const endTime: number = Math.floor(performance.now());
		const timeDiff: number = endTime - startTime;
		setTimeout(exec.bind(null, props), timeDiff >= INTERVAL ? 0 : INTERVAL - timeDiff);
	});
}

export async function startAppointment(): Promise<void> {
	const strategyStack = await Registry.getAppointmentStrategyStack();
	if(!strategyStack.length) {
		LOGGER.warning("Работа Тутмед Бота была автоматически завершена, так как в файле 'appointment.strategies.ts' не обнаружено ни одной стратегии записи на приём для выполнения.");
		LOGGER.help("Добавьте хотя бы одну стратегию записи на приём в файл 'appointment.strategies.ts'.");
		exitProcess();
	}
	for(const strategyStackItem of strategyStack) exec({
		strategyStackItem
	});
	if(Settings.APPOINTMENT.AUTO_COMPLETE_TIMEOUT) setTimeout(autoExit, Settings.APPOINTMENT.AUTO_COMPLETE_TIMEOUT);
}