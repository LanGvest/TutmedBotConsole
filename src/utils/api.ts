import axios, {AxiosError, CreateAxiosDefaults} from "axios";
import {decodeKoi8R} from "./koi8r";
import {AppointmentDate, AppointmentTime, Category, ContentBlock, Employee, Institution, InstitutionsSourceUrl, Patient} from "./types";
import {exitProcess, getCorrectWord, getDurationStamp, HttpStatus, Nullable, sleep} from "./helpers";
import Settings from "../../settings";
import {getLogger} from "./logger";
import {buildCategory, buildEmployee, buildHashCode, buildInstitution} from "./builders";
import Registry from "./registry";
import {LoggerName} from "../enums/loggerName.enum";
import * as process from "process";
import {getPersonNameGenderByLastName, PersonNameCase, RecasedPersonName, recasePersonName} from "./petrovich";
import {getTime} from "./time";

const LOGGER = getLogger();
const DEBUG_LOGGER = getLogger(LoggerName.DEBUG);
const API_LOGGER = getLogger(LoggerName.API);

if(!Settings.SHOW_API_LOGS) API_LOGGER.disable();

interface GetContentBlocksProps {
	institution: Institution
}

interface GetEmployeesProps {
	institution: Institution
}

interface GetDatesProps {
	employee: Employee
}

interface GetTimesProps {
	employee: Employee
	date: AppointmentDate
}

interface MakeAnAppointmentProps {
	attempt: number
	notifyList: Array<Patient>
	employee: Employee
	date: AppointmentDate
	time: AppointmentTime
	patient: Patient
}

interface GetInstitutions {
	sourceUrl: InstitutionsSourceUrl
}

interface UrlParams {
	[key: string]: string | number
}

interface SendViberTextMessageProps {
	viberUid: string
	message: string
}

interface AppointmentSystemInfo {
	[key: string]: string | number | boolean | null | undefined
}

declare module "axios" {
	// noinspection JSUnusedGlobalSymbols
	interface AxiosRequestConfig {
		_retryCount?: number;
	}
}

export default class Api {
	private static readonly axiosConfig: CreateAxiosDefaults = {
		baseURL: "https://tutmed.by"
	};

	private static crushReportCount: number = 0;
	private static readonly axiosInstance = axios.create(Api.axiosConfig);

	static {
		Api.axiosInstance.interceptors.response.use(config => config, async (error: AxiosError) => {
			if(error.config && error.config.method && error.config.url && error.response && error.response.status === HttpStatus.TOO_MANY_REQUESTS) {
				const retryCount: number = error.config._retryCount || 0;
				API_LOGGER.warning(`Повторная отправка запроса: ${Api.buildApiStamp(error.config.method, error.config.url, error.config.data)}`);
				await sleep(Math.floor(Settings.TOO_MANY_REQUESTS_TIMEOUT + retryCount * Settings.TOO_MANY_REQUESTS_TIMEOUT * 0.1));
				error.config._retryCount = retryCount + 1;
				return Api.axiosInstance.request(error.config);
			} else {
				const maxCrushReportCount: number = Settings.MAX_ERROR_REPORT_COUNT;
				const admin = await Registry.getAdmin();
				if(Api.crushReportCount === maxCrushReportCount) {
					LOGGER.strongWarning("Превышен лимит по отчётам об ошибках!");
					if(admin && admin.viberUid) {
						try {
							await Api.sendTextMessage({
								viberUid: admin.viberUid,
								message: (
									`🛑 Тутмед Бот аварийно завершил свою работу, так как достиг лимита в ${maxCrushReportCount} ${getCorrectWord("отчётов", "отчёт", "отчёта", maxCrushReportCount)} об ${maxCrushReportCount > 1 ? "ошибках" : "ошибке"}!\n\n`
									+ `*Лимит отчётов об ошибках:* ${maxCrushReportCount}\n`
									+ Api.buildBaseSystemInfoStamp()
								)
							});
							API_LOGGER.info("Отчёт об аварийном завершении работы был успешно отправлен администратору.");
						} catch(e) {
							API_LOGGER.error("Не удалось отправить отчёт об аварийном завершении работы администратору:", e);
						}
					}
					LOGGER.error("Тутмед Бот аварийно завершил свою работу!");
					exitProcess(1);
				} else {
					API_LOGGER.error("Произошла неизвестная сетевая ошибка:", error.toJSON());
					Api.crushReportCount++;
					if(admin && admin.viberUid) {
						try {
							const errorInfo: any = error.toJSON();
							if(errorInfo.stack) delete errorInfo.stack;
							let apiStamp: string = "";
							if(error.config && error.config.method && error.config.url) {
								apiStamp = Api.buildApiStamp(error.config.method, error.config.url, error.config.data);
							}
							await Api.sendTextMessage({
								viberUid: admin.viberUid,
								message: (
									"⚠️ Произошла неизвестная сетевая ошибка!\n\n"
									+ (apiStamp ? `*Запрос:* ${apiStamp}\n` : "")
									+ Api.buildBaseSystemInfoStamp() + "\n\n"
									+ "*Сетевая ошибка:* " + JSON.stringify(errorInfo, null, 2)
								)
							});
							API_LOGGER.info("Отчёт об ошибке был успешно отправлен администратору.");
						} catch(e) {
							API_LOGGER.error("Не удалось отправить отчёт об ошибке администратору:", e);
						}
					}
				}
				throw error;
			}
		});
	}

	private static buildApiStamp(method: string, endpoint: string, params: UrlParams | string = {}): string {
		method = method.trim().toUpperCase();
		if(!/^https?:\/\//.test(endpoint)) endpoint = `${Api.axiosConfig.baseURL}/${endpoint}`;
		endpoint = endpoint
			.trim()
			.replace(/^https?:\/\//, "")
			.replace(/[\/\\]+/g, "/")
			.replace(/^\/|\/$/g, "");
		let plainParams: string = "";
		if(typeof params === "string") {
			if(params) plainParams = "?" + params;
		} else if(typeof params === "object" && params !== null) {
			const keys: Array<string> = Object.keys(params);
			if(keys.length) plainParams = "?" + keys.map(key => `${key}=${encodeURIComponent(params[key])}`).join("&");
		}
		return `${method} ${endpoint}${plainParams}`;
	}

	private static logRequest(urlPath: string): void {
		API_LOGGER.wait(`Отправка запроса: ${urlPath}`);
	}

	public static async getInstitutions({sourceUrl}: GetInstitutions): Promise<Array<Institution>> {
		sourceUrl = sourceUrl.trim() as InstitutionsSourceUrl;
		if(!/^https?:\/\/tutmed\.by\/region\/(br|gm|mg|mnsk)\/(poli|bol|dis)$/.test(sourceUrl)) {
			LOGGER.error(`Указанный адрес '${sourceUrl}' не может выступать в качестве источника медучреждений!`);
			LOGGER.help(`Чтобы исправить эту ошибку удалите стратегии аудита и записи на приём с этим адресом источника медучреждений из файлов 'audit.strategies.ts' и 'appointment.strategies.ts' соответственно или замените его на другой адрес.`);
			LOGGER.help(`Получить адрес источника медучреждений можно из адресной строки браузера на официальном веб-сайте медицинской информационной системы Беларуси (tutmed.by) с нужным медучреждением.`);
			exitProcess(1);
		}
		const method: string = "GET";
		const endpoint: string = sourceUrl;
		Api.logRequest(Api.buildApiStamp(method, endpoint));
		const res = await Api.axiosInstance.get<string>(endpoint, {
			method
		});
		const onlineAppointmentCode: number = buildHashCode("Интернет запись на прием");
		const siteUrlCode: number = buildHashCode("Собственный сайт УЗ");
		const result: Array<Institution> = [];
		res.data.match(/<div class="content-item">.+?<div class="clrfx">\s*<\/div>\s*<\/div>\s*<\/div>/sg)?.forEach(div => {
			div = div.replace(/[\t\n\f\r\v\u00A0\u2028\u2029]/sg, "");
			let onlineAppointmentSiteUrl: Nullable<string> = null;
			let siteUrl: Nullable<string> = null;
			div.match(/<div class="item-service">.+?<\/div>/sg)?.forEach(service => {
				const code: number = buildHashCode(service.replace(/<.+?>|&.+?;/sg, " "));
				if(code === onlineAppointmentCode) {
					onlineAppointmentSiteUrl = service.match(/(?<=href=").+?(?=")/s)![0] as string;
					onlineAppointmentSiteUrl = onlineAppointmentSiteUrl.trim().replace(/\\/g, "/");
					if(!/^https?:\/\//.test(onlineAppointmentSiteUrl)) onlineAppointmentSiteUrl = `${Api.axiosConfig.baseURL}${onlineAppointmentSiteUrl.startsWith("/") ? "" : "/"}${onlineAppointmentSiteUrl}`;
				} else if(code === siteUrlCode) {
					siteUrl = service.match(/(?<=href=").+?(?=")/s)![0] as string;
					siteUrl = siteUrl.trim().replace(/\\/g, "/");
					if(!/^https?:\/\//.test(siteUrl)) siteUrl = `${Api.axiosConfig.baseURL}${siteUrl.startsWith("/") ? "" : "/"}${siteUrl}`;
				}
			});
			result.push(buildInstitution({
				id: div.match(/(?<=sfl_=|sfil_n=)\d+/s)![0],
				name: div.match(/(?<=<div class="item-title">).+?(?=<\/div>)/s)![0],
				defaultImageUrl: div.match(/(?<=<div class="item-favicon">).+?(?=<\/div>)/s)![0].match(/(?<=src=").+(?=")/s)![0],
				sourceUrl,
				siteUrl,
				onlineAppointmentSiteUrl
			}));
		});
		return result;
	}

	public static async getContentBlocks({institution}: GetContentBlocksProps): Promise<Array<ContentBlock>> {
		const providerSiteUrl: Nullable<string> = institution.onlineAppointmentSiteUrl;
		if(!providerSiteUrl) {
			LOGGER.error(`Невозможно проиндексировать веб-сайт онлайн-записи на приём медучреждения '${institution.name}', так как данная услуга в этом медучреждении не предоставляется!`);
			LOGGER.help(`Чтобы исправить эту ошибку удалите из кода все попытки получения медработников или блоков контента данного медучреждения.`);
			exitProcess(1);
		}
		const method: string = "GET";
		const endpoint: string = providerSiteUrl;
		Api.logRequest(Api.buildApiStamp(method, endpoint));
		const res = await Api.axiosInstance.get<string>(endpoint, {
			responseType: "arraybuffer",
			method
		});
		const result: Array<ContentBlock> = [];
		decodeKoi8R(res.data)
			.match(/<table.*?>(.*?)<\/table>/s)![1]
			.replace(/[\t\n\f\r\v\u00A0\u2028\u2029]/sg, "")
			.replace(/<tr.*?(?<!\/)>(.*?)<\/tr>/sg, (match: string, $1: string) => $1
				.replace(/<td.+?" *(?<!\/)>(.*?)<\/td>/sg, (match: string, $1: string) => {
					const eidMatch = match.match(/js_11_60_1\s*\(\s*(\d+)\s*,/);
					if(eidMatch) {
						const row = $1.replace(/< *br *\/?>/i, "@SPLIT@").split("@SPLIT@");
						result.push({
							type: "employee",
							id: eidMatch[1],
							name: row[0].replace(/\s/sg, " ").trim(),
							details: row[1].replace(/\s/sg, " ").replace(/< *br *\/?>/sg, "\n").trim()
						});
					} else {
						result.push({
							type: "text",
							value: $1.replace(/\s/sg, " ").replace(/< *br *\/?>/sg, "\n").trim()
						});
					}
					return "";
				})
			);
		return result;
	}

	public static async getEmployees({institution}: GetEmployeesProps): Promise<Array<Employee>> {
		const contentBlocks = await Api.getContentBlocks({
			institution
		});
		const result: Array<Employee> = [];
		let currentCategory: Nullable<Category> = null;
		for(const item of contentBlocks) {
			if(item.type === "employee") {
				if(!currentCategory) continue;
				result.push(buildEmployee({
					id: item.id,
					name: item.name,
					details: item.details,
					institution,
					category: currentCategory
				}));
			} else {
				const category = buildCategory({
					name: item.value
				});
				if(category.name.length <= 60) currentCategory = category;
			}
		}
		return result;
	}

	public static async getDates({employee}: GetDatesProps): Promise<Array<AppointmentDate>> {
		const method: string = "GET";
		const endpoint: string = "cgi-bin/is11_61";
		const data: string = `sfl_=${employee.institution.id}&ncod_=${employee.id}&swho_=&nocard=0`;
		Api.logRequest(Api.buildApiStamp(method, endpoint, data));
		const res = await Api.axiosInstance.get<string>(endpoint, {
			responseType: "arraybuffer",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			method,
			data
		});
		const result: Array<AppointmentDate> = [];
		decodeKoi8R(res.data)
			.match(/<table.*?>(.*?)<\/table>/s)![1]
			.replace(/[\t\n\f\r\v\u00A0\u2028\u2029]/sg, "")
			.replace(/<tr.*?(?<!\/)>(.*?)<\/tr>/sg, (match: string, $1: string) => {
				const dateInfoMatch = match.match(/js_11_61_1\s*\(\s*\d+\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
				if(dateInfoMatch) {
					const typeValue: string = match
						.match(/(?<=>).+(?=<\/)/)![0]
						.match(/< *td.*?>.+?<\/ *td *>/g)![3]
						.match(/(?<=>).+(?=<\/)/)![0];
					result.push({
						id: dateInfoMatch[1],
						value: $1.match(/(?<=>)\d+\.\d+\.\d+(?=<)/s)![0],
						type: {
							id: dateInfoMatch[2],
							value: typeValue,
							code: buildHashCode(typeValue)
						}
					});
				}
				return "";
			});
		return result;
	}

	public static async getTimes({employee, date}: GetTimesProps): Promise<Array<AppointmentTime>> {
		const method: string = "GET";
		const endpoint: string = "cgi-bin/is11_62";
		const data: string = `sfl_=${employee.institution.id}&ncod_=${employee.id}&ndat_=${date.id}&ntyp_=${date.type.id}`;
		Api.logRequest(Api.buildApiStamp(method, endpoint, data));
		const res = await Api.axiosInstance.get<string>(endpoint, {
			responseType: "arraybuffer",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			method,
			data
		});
		const result: Array<AppointmentTime> = [];
		decodeKoi8R(res.data)
			.match(/<table.*?>(.*?)<\/table>/s)![1]
			.replace(/[\t\n\f\r\v\u00A0\u2028\u2029]/sg, "")
			.replace(/js_11_62_1\s*\(\s*(\d+)\s*,\s*'(.+?)'\s*\)/sg, (match: string, $1: string, $2: string) => {
				result.push({
					id: $1,
					value: $2.trim()
				});
				return "";
			});
		return result;
	}

	private static async sendTextMessage({viberUid, message}: SendViberTextMessageProps): Promise<void> {
		const method: string = "POST";
		const endpoint: string = "https://chatapi.viber.com/pa/send_message";
		const data = {
			type: "text",
			receiver: viberUid,
			text: message,
			sender: {
				name: "Тутмед Бот"
			}
		};
		Api.logRequest(Api.buildApiStamp(method, endpoint, {
			type: "text",
			receiver: viberUid,
			text: "..."
		}));
		const res = await axios.request({
			url: endpoint,
			method,
			headers: {
				"X-Viber-Auth-Token": process.env.VIBER_BOT_TOKEN
			},
			data
		});
		if(res.data.status !== 0) {
			data.text = data.text.length > 50 ? data.text.substring(0, 200) + "..." : data.text;
			throw {
				message: "An unexpected Viber API error has occurred.",
				request: {
					method,
					url: endpoint,
					data
				},
				response: res.data
			};
		}
	}

	private static buildAdditionalAppointmentInfoStamp({employee}: MakeAnAppointmentProps): string {
		return `*Доп. информация:* ${employee.details}`;
	}

	private static buildAppointmentInfoStamp({employee, date, time, patient}: MakeAnAppointmentProps, samePatient: boolean): string {
		return `*Медработник:* ${employee.name} (${employee.category.name.toLowerCase()})\n*Дата приёма:* ${date.value}\n*Время приёма:* ${time.value}\n*Пациент${samePatient ? " (Вы)" : ""}:* ${patient.lastName} ${patient.firstName} ${patient.middleName}\n*Тип приёма:* ${date.type.value}\n*Медучреждение:* ${employee.institution.name}`;
	}

	private static buildBaseSystemInfoStamp(): string {
		const now = getTime();
		const lifetime: number = Math.floor(performance.now());
		return `*Временной штамп:* \`\`\`${now.getTimestamp()}\`\`\` (${now.format("YYYY-MM-dd HH:mm:ss.SSS")})\n*Время непрерывной работы:* ${getDurationStamp({ms: lifetime, withMilliseconds: true})}`;
	}

	private static buildSimpleSystemInfoStamp({attempt}: MakeAnAppointmentProps): string {
		return `*Попытка:* ${attempt}\n${Api.buildBaseSystemInfoStamp()}`;
	}

	private static buildPatientHelloStamp({employee, attempt, date, time, patient}: MakeAnAppointmentProps, dativeEmployeeName: RecasedPersonName): string {
		return `Здравствуйте, ${patient.firstName}! 👋\nХочу сообщить, что с ${attempt} попытки Вы были автоматически записаны на приём к *${dativeEmployeeName.lastName} ${employee.nameInitials}* (${employee.category.name.toLowerCase()}) на *${date.value}* в *${time.value}*.`;
	}

	private static buildNotifyPatientHelloStamp({employee, attempt, date, time, patient}: MakeAnAppointmentProps, dativeEmployeeName: RecasedPersonName, notifyPatient: Patient): string {
		return `Здравствуйте, ${notifyPatient.firstName}! 👋\nХочу сообщить, что с ${attempt} попытки *${patient.firstName} ${patient.lastName}* ${patient.isFemale ? "была" : "был"} автоматически ${patient.isFemale ? "записана" : "записан"} на приём к *${dativeEmployeeName.lastName} ${employee.nameInitials}* (${employee.category.name.toLowerCase()}) на *${date.value}* в *${time.value}*.\n⚠️ Предупредите ${patient.isFemale ? "её" : "его"} об этом, пожалуйста (например, по телефону), на случай, если ${patient.isFemale ? "она" : "он"} забудет проверить свой Вайбер.`;
	}

	private static buildDebugMark(): string {
		return "```[DEBUG]```";
	}

	private static getAppointmentSystemInfo({employee, attempt, notifyList, date, time, patient}: MakeAnAppointmentProps, adminViberUid: Nullable<string>): AppointmentSystemInfo {
		const info: AppointmentSystemInfo = {
			"attempt": attempt,
			"employee.id": employee.id,
			"employee.name": employee.name,
			"employee.category.name": employee.category.name,
			"employee.institution.id": employee.institution.id,
			"employee.institution.name": employee.institution.name,
			"date.id": date.id,
			"date.value": date.value,
			"date.type.id": date.type.id,
			"date.type.value": date.type.value,
			"time.id": time.id,
			"time.value": time.value,
			"patient.uid": patient.uid,
			"patient._name": `${patient.lastName} ${patient.firstName} ${patient.middleName}`,
			"patient.number": patient.number,
			"patient.pin": patient.pin,
			"patient.isFemale": patient.isFemale,
			"patient._phoneNumber": "+375" + patient.phoneNumberBase,
			"patient.viberUid": patient.viberUid
		};
		if(Settings.DEBUG) info["[DEBUG] adminViberUid"] = adminViberUid;
		if(notifyList.length) for(let i = 0; i < notifyList.length; i++) {
			const notifyPatient = notifyList[i];
			info[`notifyList[${i}].uid`] = notifyPatient.uid;
			info[`notifyList[${i}]._name`] = `${notifyPatient.lastName} ${notifyPatient.firstName} ${notifyPatient.middleName}`;
			info[`notifyList[${i}]._phoneNumber`] = "+375" + notifyPatient.phoneNumberBase;
			info[`notifyList[${i}].viberUid`] = notifyPatient.viberUid;
		}
		return info;
	}

	private static buildAppointmentSystemInfoStamp(props: MakeAnAppointmentProps, adminViberUid: Nullable<string>): string {
		const info = Api.getAppointmentSystemInfo(props, adminViberUid);
		return Object.keys(info).map(key => `*${key}:* ${info[key]}`).join("\n");
	}

	private static logAppointment(props: MakeAnAppointmentProps, adminViberUid: Nullable<string>): void {
		console.table(Api.getAppointmentSystemInfo(props, adminViberUid));
	}

	public static async makeAnAppointment(props: MakeAnAppointmentProps): Promise<boolean> {
		if(Settings.DEBUG) DEBUG_LOGGER.warning("Запрос записи на приём не будет отправлен, так как активирован режим отладки. Все действия являются симуляцией.");
		const {employee, notifyList, date, time, patient} = props;
		const method: string = "POST";
		const endpoint: string = "cgi-bin/is11_62";
		const data: string = `sfl_=${employee.institution.id}&ncod_=${employee.id}&ndat_=${date.id}&ntyp_=${date.type.id}&stim_=${time.id}&snum_=${patient.number}&spin_=${patient.pin}`;
		if(!Settings.DEBUG) Api.logRequest(Api.buildApiStamp(method, endpoint, data));
		const dativeEmployeeName = recasePersonName({
			gender: getPersonNameGenderByLastName(employee.lastName),
			lastName: employee.lastName
		}, PersonNameCase.DATIVE);
		let adminViberUid: Nullable<string> = null;
		let patientViberUid: Nullable<string> = patient.viberUid;
		if(Settings.DEBUG) {
			const admin = await Registry.getAdmin();
			patientViberUid = adminViberUid = admin?.viberUid || null;
			DEBUG_LOGGER.info("Все уведомления, предназначенные для пациента, перенаправлены на администратора.");
		}
		if(!patientViberUid) {
			LOGGER.error("Невозможно записать пациента на приём, так как ему невозможно отправить уведомление о записи на приём.");
			Api.logAppointment(props, adminViberUid);
			return false;
		}
		try {
			if(!Settings.DEBUG) await Api.axiosInstance.get<string>(endpoint, {
				responseType: "arraybuffer",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded"
				},
				method,
				data
			});
			LOGGER.success(`${patient.lastName} ${patient.firstName[0]}.${patient.middleName[0]}. ${patient.isFemale ? "была" : "был"} успешно ${patient.isFemale ? "записана" : "записан"} на приём к ${dativeEmployeeName.lastName} ${employee.nameInitials} на ${date.value} в ${time.value}!`);
			Api.logAppointment(props, adminViberUid);
		} catch(e) {
			LOGGER.error("Не удалось записать пациента на приём:", e);
			Api.logAppointment(props, adminViberUid);
			const admin = await Registry.getAdmin();
			if(!admin || !admin.viberUid) return false;
			try {
				await Api.sendTextMessage({
					viberUid: admin.viberUid,
					message: (
						`⚠️ Произошла неизвестная ошибка при попытке записи пациента на приём!\n\n`
						+ Api.buildAppointmentSystemInfoStamp(props, adminViberUid) + "\n\n"
						+ Api.buildBaseSystemInfoStamp() + "\n\n"
						+ "*Ошибка:* " + JSON.stringify(e, null, 2)
					)
				});
				API_LOGGER.info("Отчёт об ошибке был успешно отправлен администратору.");
			} catch(e) {
				API_LOGGER.error("Не удалось отправить отчёт об ошибке администратору:", e);
			}
			return false;
		}
		try {
			await Api.sendTextMessage({
				viberUid: patientViberUid,
				message: (
					(Settings.DEBUG ? Api.buildDebugMark() + " " : "")
					+ Api.buildPatientHelloStamp(props, dativeEmployeeName) + "\n\n"
					+ Api.buildAdditionalAppointmentInfoStamp(props) + "\n\n"
					+ Api.buildAppointmentInfoStamp(props, true) + "\n\n"
					+ Api.buildSimpleSystemInfoStamp(props)
				)
			});
			API_LOGGER.info("Уведомление о записи на приём было успешно отправлено пациенту.");
		} catch(e) {
			API_LOGGER.error("Не удалось отправить пациенту уведомление о записи на приём:", e);
			const admin = await Registry.getAdmin();
			if(!admin || !admin.viberUid) return false;
			try {
				await Api.sendTextMessage({
					viberUid: admin.viberUid,
					message: (
						"⚠️ Произошла неизвестная ошибка при попытке отправки пациенту уведомления о записи на приём!\n\n"
						+ Api.buildAppointmentSystemInfoStamp(props, adminViberUid) + "\n\n"
						+ Api.buildBaseSystemInfoStamp() + "\n\n"
						+ "*Ошибка:* " + JSON.stringify(e, null, 2)
					)
				});
				API_LOGGER.info("Отчёт об ошибке был успешно отправлен администратору.");
			} catch(e) {
				API_LOGGER.error("Не удалось отправить отчёт об ошибке администратору:", e);
			}
			return false;
		}
		try {
			if(!notifyList.length) return true;
			if(!Settings.DEBUG) await Promise.all(notifyList.map(notifyPatient => Api.sendTextMessage({
				viberUid: notifyPatient.viberUid!,
				message: (
					(Settings.DEBUG ? Api.buildDebugMark() + " " : "")
					+ Api.buildNotifyPatientHelloStamp(props, dativeEmployeeName, notifyPatient) + "\n\n"
					+ Api.buildAdditionalAppointmentInfoStamp(props) + "\n\n"
					+ Api.buildAppointmentInfoStamp(props, false) + "\n\n"
					+ Api.buildSimpleSystemInfoStamp(props)
				)
			})));
			API_LOGGER.info(`Уведомление с просьбой напоминания о записи на приём было успешно отправлено ${notifyList.length} ${getCorrectWord("наблюдателям", "наблюдателю", "наблюдателям", notifyList.length)}.`);
			return true;
		} catch(e) {
			API_LOGGER.error("Не удалось отправить наблюдателю уведомление с просьбой напоминания о записи на приём:", e);
			const admin = await Registry.getAdmin();
			if(!admin || !admin.viberUid) return false;
			try {
				await Api.sendTextMessage({
					viberUid: admin.viberUid,
					message: (
						"⚠️ Произошла неизвестная ошибка при попытке отправки наблюдателю уведомления с просьбой напоминания о записи на приём!\n\n"
						+ Api.buildAppointmentSystemInfoStamp(props, adminViberUid) + "\n\n"
						+ Api.buildBaseSystemInfoStamp() + "\n\n"
						+ "*Ошибка:* " + JSON.stringify(e, null, 2)
					)
				});
				API_LOGGER.info("Отчёт об ошибке был успешно отправлен администратору.");
			} catch(e) {
				API_LOGGER.error("Не удалось отправить отчёт об ошибке администратору:", e);
			}
			return false;
		}
	}

	public static async getPatients(): Promise<Array<Patient>> {
		const method: string = "GET";
		const endpoint: string = "https://api.tutmed.langvest.by/patients";
		Api.logRequest(Api.buildApiStamp(method, endpoint));
		const res = await this.axiosInstance.get(endpoint, {
			method,
			headers: {
				"Access-Token": process.env.API_TOKEN
			}
		});
		return res.data;
	}
}