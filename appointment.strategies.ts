import {AppointmentStrategy} from "./src/utils/types";
import {EmployeeEntry} from "./src/entries/employee.entry";
import {DateEntry} from "./src/entries/date.entry";
import {TimeEntry} from "./src/entries/time.entry";

const AppointmentStrategies: Array<AppointmentStrategy> = [
	{
		institution: "Гомельская городская клиническая поликлиника 8",
		source: "https://tutmed.by/region/gm/poli",
		patient: "Логвинец Вячеслав Александрович",
		notify: [
			"Семешко Лидия Петровна",
			"Логвинец Елена Александровна"
		],
		entries: {
			"Врач общей практики": [
				{
					type: "Приём через интернет",
					employee: {
						strict: false,
						prefer: [
							// EmployeeEntry.point("Сильченко В.А.")
						],
						ignore: []
					},
					date: {
						strict: false,
						prefer: [
							// DateEntry.span("03.07.2023", "09.07.2023")
						],
						ignore: [
							DateEntry.point("07.07.2023")
						]
					},
					time: {
						strict: true,
						prefer: [
							TimeEntry.span("9:00", "11:00").desc(),
							TimeEntry.span("11:00", "20:00")
						],
						ignore: []
					}
				}
			],
			// "Помощник врача по амбулаторно-поликлинической помощи": [
			// 	{
			// 		type: "Приём через интернет",
			// 		employee: {
			// 			strict: false,
			// 			prefer: [],
			// 			ignore: []
			// 		},
			// 		date: {
			// 			strict: false,
			// 			prefer: [],
			// 			ignore: []
			// 		},
			// 		time: {
			// 			strict: false,
			// 			prefer: [],
			// 			ignore: []
			// 		}
			// 	}
			// ]
		}
	},
	// {
	// 	institution: "гуз Гомельская городская клиническая поликлиника N4",
	// 	source: "https://tutmed.by/region/gm/poli",
	// 	patient: "Логвинец Вячеслав Александрович",
	// 	notify: ["Логвинец Вячеслав Александрович"],
	// 	entries: {
	// 		"Врач - акушер-гинеколог": [
	// 			{
	// 				type: "Приём через интернет",
	// 				employee: {
	// 					strict: false,
	// 					prefer: [],
	// 					ignore: []
	// 				},
	// 				date: {
	// 					strict: false,
	// 					prefer: [
	// 						DateEntry.span("13.03.2023", "15.03.2023")
	// 					],
	// 					ignore: [
	// 						DateEntry.span("03.03.2023", "07.03.2023")
	// 					]
	// 				},
	// 				time: {
	// 					strict: false,
	// 					prefer: [],
	// 					ignore: [
	// 						TimeEntry.span("8:00", "15:45")
	// 					]
	// 				}
	// 			}
	// 		]
	// 	}
	// }
];

export default AppointmentStrategies;