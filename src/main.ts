require("dotenv").config();

import "./utils/global";
import {getLogger} from "./utils/logger";
import Settings from "../settings";
import {StartupMode, UnsafeStartupMode} from "./utils/types";
import {startAudit} from "./core/audit";
import {startAppointment} from "./core/appointment";
import {exitProcess, getDurationStamp, Nullable} from "./utils/helpers";
import {LoggerName} from "./enums/loggerName.enum";

const LOGGER = getLogger();
const DEBUG_LOGGER = getLogger(LoggerName.DEBUG);

type Starter = () => Promise<void>;

interface StarterKit {
	starter: Starter
	mode0: string
}

type StarterKits = {
	[mode in StartupMode]: StarterKit;
};

const starterKits: StarterKits = {
	appointment: {
		starter: startAppointment,
		mode0: "записи на приём"
	},
	audit: {
		starter: startAudit,
		mode0: "аудита"
	}
};

(async () => {
	LOGGER.clear();
	const mode: UnsafeStartupMode = Settings.MODE.replace(/\s+/, " ").toLowerCase().trim();
	if(!mode) {
		LOGGER.error(`Тутмед Бот не может быть запущен без указания режима запуска!`);
		LOGGER.help(`Все допустимые режимы запуска Тутмед Бота описаны в типе 'AllowedMode' в файле './src/utils/types.ts'.`);
		exitProcess(1);
	}
	const starterKit: Nullable<StarterKit> = starterKits[mode as StartupMode] || null;
	if(!starterKit) {
		LOGGER.error(`Тутмед Бот не может быть запущен в режиме '${mode}', так как этот режим не является допустимым!`);
		LOGGER.help(`Все допустимые режимы запуска Тутмед Бота описаны в типе 'AllowedMode' в файле './src/utils/types.ts'.`);
		exitProcess(1);
	}
	LOGGER.info(`Тутмед Бот успешно запущен в режиме ${starterKit.mode0}!`);
	if(Settings.DEBUG) DEBUG_LOGGER.info("Активирован режим отладки.");
	await starterKit.starter();
})();