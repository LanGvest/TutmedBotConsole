import {
	AppointmentEntries,
	AppointmentStrategy,
	AppointmentTypeCategory,
	AppointmentTypeCodes,
	AppointmentTypes,
	Category,
	Employee,
	FullName,
	Institution,
	InstitutionsSourceUrl,
	Patient
} from "./types";
import {exitProcess, Nullable} from "./helpers";
import Registry from "./registry";
import Logger, {getLogger} from "./logger";
import {AppointmentEntriesStackItem, AppointmentStrategiesStackItem} from "./strategies";
import {LoggerName} from "../enums/loggerName.enum";

const LOGGER: Logger = getLogger(LoggerName.BUILDERS);

export function buildHashCode(value: string): number {
	return value.replace(/[^а-яёa-z\d]/gi, "").toLowerCase().replace(/ё/g, "е").getHashCode();
}

export function buildInstitutionHashCode(value: string): number {
	return buildHashCode(value.replace(/^гуз /i, ""));
}

interface BuildEmployeeProps {
	id: string
	name: string
	details: string
	institution: Institution
	category: Category
}

export function buildEmployee({id, name, details, category, institution}: BuildEmployeeProps): Employee {
	name = name
		.replace(/\s+/g, " ")
		.trim()
		.ucFirst();
	details = details
		.replace(/\s+/g, " ")
		.replace(/^\s+|\s+$/gm, "")
		.trim()
		.ucFirst();
	const nameSplit: string[] = name.split(/\s+/);
	return {
		id,
		lastName: nameSplit[0],
		nameInitials: nameSplit[1],
		name,
		details,
		category,
		institution,
		code: buildHashCode(name)
	};
}

interface BuildInstitutionProps {
	id: string
	name: string
	siteUrl: Nullable<string>
	sourceUrl: InstitutionsSourceUrl
	defaultImageUrl: string
	onlineAppointmentSiteUrl: Nullable<string>
}

export function buildInstitution({id, name, siteUrl, sourceUrl, defaultImageUrl, onlineAppointmentSiteUrl}: BuildInstitutionProps): Institution {
	name = name
		.replace(/\s+/g, " ")
		.replace(/[«»'"]+/g, "")
		.replace(/г\.(?=\S)/g, "г. ")
		.replace(/\s*им\.(?=\S)/g, " им. ")
		.replace(/(?<= им\. [А-ЯЁ]\.)\s*(?=[А-ЯЁ]\.)/g, "")
		.replace(/(?<= им\. [А-ЯЁ]\.[А-ЯЁ]\.)\s*/g, " ")
		.replace(/[N№]\s*(?=\d)/g, "№")
		.replace(/^\s*г\s*у\s*з\s*/i, "ГУЗ ")
		.trim()
		.ucFirst();
	return {
		id,
		name,
		siteUrl,
		sourceUrl,
		defaultImageUrl,
		onlineAppointmentSiteUrl,
		code: buildInstitutionHashCode(name)
	};
}

interface BuildCategoryProps {
	name: string
}

export function buildCategory({name}: BuildCategoryProps): Category {
	name = name
		.replace(/ +/sg, " ")
		.replace(" - ", " ")
		.replace(/ *- */g, "-")
		.replace(/^ *врач *- */i, "Врач ")
		.trim()
		.ucFirst();
	return {
		name,
		code: buildHashCode(name)
	};
}

interface BuildAppointmentEntriesStackProps {
	view: AppointmentEntries
}


function buildAppointmentEntriesStack({view}: BuildAppointmentEntriesStackProps): Array<AppointmentEntriesStackItem> {
	const result: Array<AppointmentEntriesStackItem> = [];
	for(const categoryName in view) result.push(new AppointmentEntriesStackItem({
		category: buildCategory({
			name: categoryName
		}),
		entries: view[categoryName]
	}));
	return result;
}

interface BuildAppointmentStrategiesStackItemProps {
	strategy: AppointmentStrategy
}

export async function buildAppointmentStrategiesStackItem({strategy}: BuildAppointmentStrategiesStackItemProps): Promise<AppointmentStrategiesStackItem> {
	strategy.institution = strategy.institution
		.replace(/\s+/g, " ")
		.trim();
	strategy.source = strategy.source
		.trim() as InstitutionsSourceUrl;
	strategy.patient = strategy.patient
		.replace(/\s+/g, " ")
		.trim() as FullName;
	const patient = await Registry.getPatientByName({
		name: strategy.patient
	});
	if(!patient) {
		LOGGER.error(`Стратегия записи на приём не может быть создана, так как пациент с ФИО '${strategy.patient}' не найден!`);
		LOGGER.help(`Чтобы исправить эту ошибку пациент должен пройти авторизацию с помощью Тутмед Бота в Вайбере, или, если он уже авторизован, проверьте правильность написания его ФИО.`);
		exitProcess(1);
	}
	if(!patient.viberUid || (!patient.isViewer && (patient.number === null || patient.pin === null))) {
		LOGGER.error(`Стратегия записи на приём не может быть создана, так как пациент с ФИО '${strategy.patient}' не авторизован!`);
		LOGGER.help(`Чтобы исправить эту ошибку пациент должен пройти авторизацию с помощью Тутмед Бота в Вайбере.`);
		exitProcess(1);
	}
	const notifyList: Array<Patient> = [];
	for(const name of strategy.notify) {
		const notifyPatient = await Registry.getPatientByName({
			name
		});
		if(!notifyPatient) {
			LOGGER.error(`Стратегия записи на приём не может быть создана, так как пациент с ФИО '${name}' не найден!`);
			LOGGER.help(`Чтобы исправить эту ошибку пациент должен пройти авторизацию с помощью Тутмед Бота в Вайбере, или, если он уже авторизован, проверьте правильность написания его ФИО.`);
			exitProcess(1);
		}
		if(!notifyPatient.viberUid) {
			LOGGER.error(`Стратегия записи на приём не может быть создана, так как пациент с ФИО '${name}' не авторизован!`);
			LOGGER.help(`Чтобы исправить эту ошибку пациент должен пройти авторизацию с помощью Тутмед Бота в Вайбере.`);
			exitProcess(1);
		}
		notifyList.push(notifyPatient);
	}
	const institution = await Registry.getInstitutionByName({
		sourceUrl: strategy.source,
		name: strategy.institution
	});
	if(!institution) {
		LOGGER.error(`Стратегия записи на приём не может быть создана, так как медучреждение '${strategy.institution}' по указанному адресу источника медучреждений '${strategy.source}' не было найдено!`);
		LOGGER.help(`Чтобы исправить эту ошибку удалите стратегии записи на приём с этим медучреждением из файла 'appointment.strategies.ts' или выберите другое медучреждение.`);
		LOGGER.help(`Выбрать медучреждение можно на официальном веб-сайте медицинской информационной системы Беларуси: https://tutmed.by.`);
		LOGGER.help(`Получить адрес источника медучреждений можно из адресной строки браузера на официальном веб-сайте медицинской информационной системы Беларуси (tutmed.by) с нужным медучреждением.`);
		exitProcess(1);
	}
	if(!institution.onlineAppointmentSiteUrl) {
		LOGGER.error(`Онлайн-запись на приём в медучреждении '${institution.name}' не осуществляется!`);
		if(institution.siteUrl) LOGGER.help(`Получить больше информации о порядке записи на приём можно на официальном веб-сейте этого медучреждения: ${institution.siteUrl}.`);
		LOGGER.help(`Чтобы исправить эту ошибку удалите стратегии записи на приём с этим медучреждением из файла 'appointment.strategies.ts' или выберите другое медучреждение.`);
		LOGGER.help(`Выбрать медучреждение можно на официальном веб-сайте медицинской информационной системы Беларуси: https://tutmed.by.`);
		LOGGER.help(`Получить адрес источника медучреждений можно из адресной строки браузера на официальном веб-сайте медицинской информационной системы Беларуси (tutmed.by) с нужным медучреждением.`);
		exitProcess(1);
	}
	return new AppointmentStrategiesStackItem({
		patient,
		institution,
		notifyList,
		entriesStack: buildAppointmentEntriesStack({
			view: strategy.entries
		})
	});
}

interface BuildAppointmentStrategiesStackProps {
	view: Array<AppointmentStrategy>
}

export async function buildAppointmentStrategiesStack({view}: BuildAppointmentStrategiesStackProps): Promise<Array<AppointmentStrategiesStackItem>> {
	const result: Array<AppointmentStrategiesStackItem> = [];
	for(const strategy of view) result.push(await buildAppointmentStrategiesStackItem({
		strategy
	}));
	return result;
}

interface BuildAppointmentTypeCodes {
	view: AppointmentTypes
}

export function buildAppointmentTypeCodes({view}: BuildAppointmentTypeCodes): AppointmentTypeCodes {
	const categories: Array<AppointmentTypeCategory> = Object.keys(view) as Array<AppointmentTypeCategory>;
	const result: AppointmentTypeCodes = {} as AppointmentTypeCodes;
	for(const category of categories) result[category] = view[category].map(type => buildHashCode(type));
	return result;
}