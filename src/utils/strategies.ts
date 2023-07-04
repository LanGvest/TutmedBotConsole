import {AppointmentEntry, Category, Institution, Patient} from "./types";
import Registry from "./registry";

interface AppointmentEntryStackItemProps {
	category: Category
	entries: Array<AppointmentEntry>
}

export class AppointmentEntriesStackItem {
	private readonly id: string;
	private readonly category: Category;
	private readonly entries: Array<AppointmentEntry>;
	private completed: boolean = false;

	public constructor({category, entries}: AppointmentEntryStackItemProps) {
		this.id = Registry.generateId();
		this.category = category;
		this.entries = entries;
	}

	public getId(): string {
		return this.id;
	}

	public getCategory(): Category {
		return this.category;
	}

	public getEntries(): Array<AppointmentEntry> {
		return this.entries;
	}

	public isCompleted(): boolean {
		return this.completed;
	}

	public complete(): void {
		this.completed = true;
	}
}

interface AppointmentStrategyStackItemProps {
	patient: Patient
	notifyList: Array<Patient>
	institution: Institution
	entriesStack: Array<AppointmentEntriesStackItem>
}

export class AppointmentStrategiesStackItem {
	private readonly id: string;
	private readonly patient: Patient;
	private readonly notifyList: Array<Patient>;
	private readonly institution: Institution;
	private readonly entriesStack: Array<AppointmentEntriesStackItem>;

	public constructor({patient, institution, entriesStack, notifyList}: AppointmentStrategyStackItemProps) {
		this.id = Registry.generateId();
		this.patient = patient;
		this.notifyList = notifyList;
		this.institution = institution;
		this.entriesStack = entriesStack;
	}

	public getId(): string {
		return this.id;
	}

	public getPatient(): Patient {
		return this.patient;
	}

	public getNotifyList(): Array<Patient> {
		return this.notifyList;
	}

	public getInstitution(): Institution {
		return this.institution;
	}

	public getEntriesStack(): Array<AppointmentEntriesStackItem> {
		return this.entriesStack;
	}

	public getNotCompletedEntriesStack(): Array<AppointmentEntriesStackItem> {
		return this.getEntriesStack().filter(entriesStackItem => !entriesStackItem.isCompleted());
	}

	public isCompleted(): boolean {
		return !this.getNotCompletedEntriesStack().length;
	}
}