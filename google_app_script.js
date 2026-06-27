async function triggerBuild() {
	const scriptProperties = PropertiesService.getScriptProperties();

	const file = SpreadsheetApp.openById("1quInsbRZ2HytcKDD3Ahhl7eGV9JdZUM3khRhvm6xneE");
	const sheets = file.getSheets();
	const resultJSONObject = {};
	const now = new Date();
	const yearToday = now.getFullYear();
	const monthToday = now.getMonth() + 1;
	const dayToday = now.getDate();

	const datesJSONObject = {};
	for (const sheet of sheets) {
		const rows = sheet.getDataRange().getValues();
		let currentRow = 0;
		while (currentRow < rows.length) {
			// Check if date instance
			// Note: instanceof doesn't work
			if (typeof rows[currentRow][0] !== "object" || rows[currentRow][0] === null) {
				currentRow++;
				continue;
			}

			const date = rows[currentRow][0];
			const year = date.getFullYear();
			const month = date.getMonth() + 1;
			const day = date.getDate();

			let dateInRange = false;
			if (year === yearToday && month === monthToday && day >= dayToday) {
				dateInRange = true;
			}
			if (year === yearToday && month < 12 && month === monthToday + 1 && day < dayToday) {
				dateInRange = true;
			}
			if (monthToday === 12 && year === yearToday + 1 && month === 1 && day < dayToday) {
				dateInRange = true;
			}

			if (!dateInRange) {
				currentRow++;

				while (currentRow < rows.length && rows[currentRow][2].toString().trim() !== "") {
					currentRow++;
				}

				continue;
			}

			currentRow++;

			let schoolClosed = false;

			const roomsJSONObject = {};
			// Room numbers are typically represented as numbers
			while (currentRow < rows.length && rows[currentRow][2].toString().trim() !== "") {
				const availabilities = [];
				for (let j = 0; j < 9; j++) {
					if (schoolClosed || rows[currentRow][3].toString().trim() === "閉館") {
						schoolClosed = true;
						availabilities.push(false);
					} else {
						const classroomAvailable = rows[currentRow][3 + j].toString().trim() === "";
						availabilities.push(classroomAvailable);
					}
				}
				roomsJSONObject[rows[currentRow][2].toString().trim()] = availabilities;
				currentRow++;
			}

			const dateKey = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
			datesJSONObject[dateKey] = roomsJSONObject;
		}
	}

	const datesJSON = JSON.stringify(datesJSONObject);

	let response;
	try {
		const url = "https://api.github.com/repos/pilcrowonpaper/itl-classrooms/dispatches";

		const options = {
			method: "post",
			contentType: "application/json",
			headers: {
				Authorization: `Bearer ${scriptProperties.getProperty("GITHUB_ACCESS_TOKEN")}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2026-03-10",
			},
			payload: JSON.stringify({
				event_type: "deploy",
				client_payload: {
					dates_json: datesJSON,
				},
			}),
			muteHttpExceptions: true,
		};

		response = UrlFetchApp.fetch(url, options);
	} catch (error) {
		throw new Error(`Failed to send request: ${error.toString()}`);
	}
	const responseCode = response.getResponseCode();
	const responseBody = response.getContentText();

	if (responseCode >= 400 && responseCode <= 499) {
		const errorMessage = JSON.parse(responseBody).message;
		throw new Error(`GitHub API error: ${errorMessage}`);
	}

	if (responseCode !== 204) {
		throw new Error(`Unexpected response status code ${responseCode}`);
	}
}
