"use strict";

const checkIconSVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><g fill='none' fill-rule='evenodd'><path d='M24 0v24H0V0zM12.593 23.258l-.011.002-.071.035-.02.004-.014-.004-.071-.035c-.01-.004-.019-.001-.024.005l-.004.01-.017.428.005.02.01.013.104.074.015.004.012-.004.104-.074.012-.016.004-.017-.017-.427c-.002-.01-.009-.017-.017-.018m.265-.113-.013.002-.185.093-.01.01-.003.011.018.43.005.012.008.007.201.093c.012.004.023 0 .029-.008l.004-.014-.034-.614c-.003-.012-.01-.02-.02-.022m-.715.002a.023.023 0 0 0-.027.006l-.006.014-.034.614c0 .012.007.02.017.024l.015-.002.201-.093.01-.008.004-.011.017-.43-.003-.012-.01-.01z'/><path fill='#ffffff' d='M21.546 5.111a1.5 1.5 0 0 1 0 2.121L10.303 18.475a1.6 1.6 0 0 1-2.263 0L2.454 12.89a1.5 1.5 0 1 1 2.121-2.121l4.596 4.596L19.424 5.111a1.5 1.5 0 0 1 2.122 0'/></g></svg>`;

const xIconSVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><g fill='none' fill-rule='evenodd'><path d='M24 0v24H0V0zM12.593 23.258l-.011.002-.071.035-.02.004-.014-.004-.071-.035c-.01-.004-.019-.001-.024.005l-.004.01-.017.428.005.02.01.013.104.074.015.004.012-.004.104-.074.012-.016.004-.017-.017-.427c-.002-.01-.009-.017-.017-.018m.265-.113-.013.002-.185.093-.01.01-.003.011.018.43.005.012.008.007.201.093c.012.004.023 0 .029-.008l.004-.014-.034-.614c-.003-.012-.01-.02-.02-.022m-.715.002a.023.023 0 0 0-.027.006l-.006.014-.034.614c0 .012.007.02.017.024l.015-.002.201-.093.01-.008.004-.011.017-.43-.003-.012-.01-.01z'/><path fill='#ffffff' d='m12 14.122 5.303 5.303a1.5 1.5 0 0 0 2.122-2.122L14.12 12l5.304-5.303a1.5 1.5 0 1 0-2.122-2.121L12 9.879 6.697 4.576a1.5 1.5 0 1 0-2.122 2.12L9.88 12l-5.304 5.304a1.5 1.5 0 1 0 2.122 2.12z'/></g></svg>`;

const datesRecordLocalStorageKey = "dates_record.1";

const dateInputElement = document.getElementById("date-input");
const searchFormElement = document.getElementById("search-form");
const searchButtonElement = document.getElementById("search-button");
const availabilityPlaceholderElement = document.getElementById("availability-placeholder");
const availabilityPlaceholderTableLoadingElement = document.getElementById(
	"availability-placeholder-table-loading",
);
const availabilityPlaceholderTableErrorElement = document.getElementById(
	"availability-placeholder-table-error",
);
const availabilityPlaceholderTableNoDataElement = document.getElementById(
	"availability-placeholder-table-no-data",
);
const availabilitySuccessElement = document.getElementById("availability-success");
const availabilityTableBodyElement = document.getElementById("availability-table-body");

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1;
const currentDay = currentDate.getDate();

dateInputElement.value = `${currentYear.toString().padStart(4, "0")}-${currentMonth.toString().padStart(2, "0")}-${currentDay.toString().padStart(2, "0")}`;

searchFormElement.addEventListener("submit", async (event) => {
	event.preventDefault();

	showLoading();

	searchButtonElement.disabled = true;

	let roomAvailabilities;
	try {
		roomAvailabilities = await getRoomAvailabilities(
			dateInputElement.valueAsDate.getFullYear(),
			dateInputElement.valueAsDate.getMonth() + 1,
			dateInputElement.valueAsDate.getDate(),
		);
	} catch (error) {
		const wrapped = new Error("Failed to get room availabilities", {
			cause: error,
		});
		console.error(wrapped);

		showError();
		searchButtonElement.disabled = false;
		return;
	}

	if (roomAvailabilities === null) {
		showNoData();
		searchButtonElement.disabled = false;
		return;
	}

	showSuccessResult(roomAvailabilities);
	searchButtonElement.disabled = false;
});

await initialize();

async function initialize() {
	let roomAvailabilities;
	try {
		roomAvailabilities = await getRoomAvailabilities(currentYear, currentMonth, currentDay);
	} catch (error) {
		const wrapped = new Error("Failed to get room availabilities", {
			cause: error,
		});
		console.error(wrapped);

		showError();
		searchButtonElement.disabled = false;
		return;
	}

	if (roomAvailabilities === null) {
		showNoData();
		searchButtonElement.disabled = false;
		return;
	}

	showSuccessResult(roomAvailabilities);
	searchButtonElement.disabled = false;
}

function showLoading() {
	availabilityPlaceholderElement.classList.remove("hidden");
	availabilitySuccessElement.classList.add("hidden");

	availabilityPlaceholderTableLoadingElement.classList.remove("hidden");
	availabilityPlaceholderTableErrorElement.classList.add("hidden");
	availabilityPlaceholderTableNoDataElement.classList.add("hidden");
}

function showError() {
	availabilityPlaceholderElement.classList.remove("hidden");
	availabilitySuccessElement.classList.add("hidden");

	availabilityPlaceholderTableLoadingElement.classList.add("hidden");
	availabilityPlaceholderTableErrorElement.classList.remove("hidden");
	availabilityPlaceholderTableNoDataElement.classList.add("hidden");
}

function showNoData() {
	availabilityPlaceholderElement.classList.remove("hidden");
	availabilitySuccessElement.classList.add("hidden");

	availabilityPlaceholderTableLoadingElement.classList.add("hidden");
	availabilityPlaceholderTableErrorElement.classList.add("hidden");
	availabilityPlaceholderTableNoDataElement.classList.remove("hidden");
}

function showSuccessResult(roomAvailabilities, lastUpdated) {
	availabilityTableBodyElement.replaceChildren();

	const roomNames = Object.keys(roomAvailabilities);
	roomNames.sort((a, b) => {
		const parsedA = parseInt(a, 10);
		const parsedB = parseInt(b, 10);
		if (parsedA !== parsedB) {
			return parsedA - parsedB;
		}
		return a.localeCompare(b);
	});

	for (const roomName of roomNames) {
		const trElement = document.createElement("tr");

		const thElement = document.createElement("th");
		thElement.innerText = roomName;
		trElement.appendChild(thElement);

		for (const roomAvailable of roomAvailabilities[roomName]) {
			const tdElement = document.createElement("td");
			const spanElement = document.createElement("span");
			if (roomAvailable) {
				spanElement.classList.add("check-icon");
				spanElement.ariaLabel = "利用可能";
				spanElement.innerHTML = checkIconSVG;
			} else {
				spanElement.classList.add("x-icon");
				spanElement.ariaLabel = "利用不可能";
				spanElement.innerHTML = xIconSVG;
			}

			tdElement.appendChild(spanElement);
			trElement.appendChild(tdElement);
		}

		availabilityTableBodyElement.appendChild(trElement);
	}

	availabilityPlaceholderElement.classList.add("hidden");
	availabilitySuccessElement.classList.remove("hidden");
}

async function getRoomAvailabilities(year, month, day) {
	const dateKey = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

	const storedDatesRecordJSON = localStorage.getItem(datesRecordLocalStorageKey);
	if (storedDatesRecordJSON !== null) {
		const storedDatesRecord = JSON.parse(storedDatesRecordJSON);
		if (Math.floor(Date.now() / 1000) - storedDatesRecord.setAt <= 60 * 10) {
			if (!(dateKey in storedDatesRecord.dates)) {
				return null;
			}

			return storedDatesRecord.dates[dateKey];
		}
	}

	const promises = [fetch("/data.json"), wait(500)];
	const results = await Promise.all(promises);
	const response = results[0];
	if (response.status !== 200) {
		await response.body.cancel();
		throw new Error(`Server returned response status ${response.status}`);
	}

	const dates = await response.json();
	const datesRecordJSONObject = {
		setAt: Math.floor(Date.now() / 1000),
		dates: dates,
	};
	const datesRecordJSON = JSON.stringify(datesRecordJSONObject);
	localStorage.setItem(datesRecordLocalStorageKey, datesRecordJSON);
	if (!(dateKey in dates)) {
		return null;
	}

	return dates[dateKey];
}

async function wait(milliseconds) {
	return new Promise((r) => setTimeout(r, milliseconds));
}
