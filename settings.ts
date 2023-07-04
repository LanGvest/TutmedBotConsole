import {Settings, UnsafeStartupMode} from "./src/utils/types";

const Settings: Settings = {
	MODE: process.env.MODE as UnsafeStartupMode,
	TOO_MANY_REQUESTS_TIMEOUT: 2_000, // 2 секунды
	API_ERROR_TIMEOUT: 5_000, // 5 секунд
	INSTITUTIONS_UPDATE_INTERVAL: 86_400_000, // 24 часа
	EMPLOYEES_UPDATE_INTERVAL: 21_600_000, // 6 часов
	SHOW_API_LOGS: true,
	DEBUG: true,
	ADMIN: "Логвинец Вячеслав Александрович",
	MAX_ERROR_REPORT_COUNT: 3,
	APPOINTMENT: {
		INTERVAL: 10_000, // 10 секунд
		AUTO_COMPLETE_TIMEOUT: null,
		SHUTDOWN_ON_COMPLETE: false,
		SHUTDOWN_TIMEOUT: 60_000 // 1 минута
	},
	AUDIT: {
		INTERVAL: 120_000, // 2 минуты
		INTERVAL_ON_SUCCESS: 60_000, // 1 минута
		OUTPUT_DIR: "./audit",
		GROUP_BY_CATEGORY: true,
		AUTO_COMPLETE_TIMEOUT: null,
		SHUTDOWN_ON_COMPLETE: false,
		SHUTDOWN_TIMEOUT: 30_000 // 30 секунд
	}
};

export default Settings;