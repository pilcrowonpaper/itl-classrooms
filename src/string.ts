export function parseNumberStringWithLeadingZeros(s: string, length: number): number {
	if (s.length !== length) {
		return NaN;
	}
	let result = 0;
	for (let i = 0; i < s.length; i++) {
		const charCode = s.charCodeAt(i);
		if (charCode < 48 || charCode > 57) {
			return NaN;
		}
		result = result * 10 + (charCode - 48);
	}
	return result;
}

export function parseNumberString(s: string): number {
	if (s === "0") {
		return 0;
	}
	let result = 0;
	for (let i = 0; i < s.length; i++) {
		const charCode = s.charCodeAt(i);
		if (i === 0 && charCode === 48) {
			return NaN;
		}
		if (charCode < 48 || charCode > 57) {
			return NaN;
		}
		result = result * 10 + (charCode - 48);
	}
	return result;
}

export function formatNumberWithLeadingZeros(n: number, count: number): string {
	let s = n.toString();
	while (s.length < count) {
		s = "0" + s;
	}
	return s;
}
