const API_SECRET = ""; // TODO: Set secret

function populate() {
	const file = SpreadsheetApp.openById("1quInsbRZ2HytcKDD3Ahhl7eGV9JdZUM3khRhvm6xneE");
	const sheets = file.getSheets();
	const resultJSONObject = {};
	const now = new Date();
	const yearToday = now.getFullYear();
	const monthToday = now.getMonth() + 1;
	const dayToday = now.getDate();
	for (const sheet of sheets) {
		const rows = sheet.getSheetValues(5, 1, 619, 12);
		let currentRow = 0;
		while (currentRow < rows.length) {
			const date = rows[currentRow][0];
			if (typeof date !== "object" || date === null) {
				currentRow++;
				continue;
			}
			const year = date.getFullYear();
			const month = date.getMonth() + 1;
			const day = date.getDate();
			const dateInPast = year <= yearToday && month <= monthToday && day < dayToday;
			if (dateInPast) {
				currentRow += 19;
				continue;
			}
			const key = `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;

			currentRow++;
			const topValue = rows[currentRow][3];
			if (topValue.trim() === "閉館") {
				resultJSONObject[key] = "////////////////////////////"; // 0xfffff...
				currentRow += 18;
				continue;
			}

			const bytes = new Uint8Array(21);
			let bitIndex = 0;
			for (let i = 0; i < 18; i++) {
				const row = currentRow + i;
				for (let j = 0; j < 9; j++) {
					const byteIndex = Math.floor(bitIndex / 8);
					const byteBitIndex = bitIndex % 8;

					const column = 3 + j;
					const value = rows[row][column];
					const classroomUsed = typeof value === "string" && value.trim() !== "";
					if (classroomUsed) {
						bytes[byteIndex] |= 0x01 << (7 - byteBitIndex);
					}
					bitIndex++;
				}
			}
			resultJSONObject[key] = Utilities.base64Encode(bytes);
			currentRow += 19;
		}
	}
	// TODO: Update URL
	const response = UrlFetchApp.fetch("https://itl-classrooms.gdgoc-chuo.com/populate-data", {
		method: "post",
		payload: JSON.stringify(resultJSONObject),
		contentType: "application/json",
		headers: {
			Secret: API_SECRET,
		},
	});
	const responseStatus = response.getResponseCode();
	const responseOk = responseStatus >= 200 && responseStatus < 300;
	if (!responseOk) {
		console.log(`API returned status ${responseOk}`);
	}
}
