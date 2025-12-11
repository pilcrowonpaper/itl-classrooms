import * as encoding from "@oslojs/encoding";

const schedulesStorageKey = "schedules";

export async function setSchedulesJSON(env: Env, schedulesJSON: string): Promise<void> {
	await env.STORAGE.put(schedulesStorageKey, schedulesJSON, {
		expirationTtl: 60 * 24,
		metadata: {
			timestamp: Math.floor(Date.now() / 1000),
		},
	});
}

export async function getScheduleRecord(
	env: Env,
	year: number,
	month: number,
	day: number,
): Promise<ScheduleRecord | null> {
	const kvRecord = await env.STORAGE.getWithMetadata(schedulesStorageKey, "json");
	if (kvRecord.value === null) {
		return null;
	}
	if (typeof kvRecord.metadata !== "object" || kvRecord.metadata === null) {
		return null;
	}
	if (!("timestamp" in kvRecord.metadata) || typeof kvRecord.metadata.timestamp !== "number") {
		return null;
	}
	const schedule = getScheduleFromJSONValue(kvRecord.value, year, month, day);
	if (schedule === null) {
		return null;
	}
	const timestamp = new Date(kvRecord.metadata.timestamp * 1000);

	const record: ScheduleRecord = {
		timestamp,
		schedule,
	};
	return record;
}

function getScheduleFromJSONValue(
	jsonValue: unknown,
	year: number,
	month: number,
	day: number,
): Schedule | null {
	const key = `${year}.${month}.${day}`;
	if (typeof jsonValue !== "object" || jsonValue === null) {
		return null;
	}
	if (!(key in jsonValue)) {
		return null;
	}
	const value = jsonValue[key as keyof typeof jsonValue] as unknown;
	if (typeof value !== "string") {
		return null;
	}
	if (value === "") {
		const schedule: Schedule = {};
		for (const room of rooms) {
			schedule[room] = Array(9).fill(true);
		}
		return schedule;
	}

	const bytes = encoding.decodeBase64(value);

	const schedule: Schedule = {};
	for (let i = 0; i < 18; i++) {
		const room = rooms[i];
		schedule[room] = [];
		for (let j = 0; j < 9; j++) {
			const index = i * 9 + j;
			const bit = (bytes[Math.floor(index / 8)] >> (7 - (index % 8))) & 0x01;
			schedule[room].push(bit === 1);
		}
	}
	return schedule;
}

export const rooms = [
	"301",
	"401",
	"501",
	"502",
	"701",
	"702",
	"801",
	"802",
	"901",
	"902",
	"1001",
	"1002",
	"1003",
	"1004",
	"1101",
	"1102",
	"1103",
	"1104",
];

export interface ScheduleRecord {
	timestamp: Date;
	schedule: Schedule;
}

export type Schedule = Record<string, boolean[]>;
