export async function sendOAuthTokenRequest(
	tokenEndpoint: string,
	body: URLSearchParams,
): Promise<object> {
	const request = new Request(tokenEndpoint, {
		method: "POST",
		body: body,
	});
	request.headers.set("Content-Type", "application/x-www-form-urlencoded");

	let response: Response;
	try {
		response = await fetch(request);
	} catch (e) {
		throw new Error("Failed to send request", {
			cause: e,
		});
	}

	if (response.status === 400 || response.status === 401) {
		if (response.body !== null) {
			await response.body.cancel();
		}
		throw new OAuthTokenRequestError();
	}

	if (response.status === 200) {
		let data: unknown;
		try {
			data = await response.json();
		} catch (e) {
			throw new Error("Failed to read json response", {
				cause: e,
			});
		}
		if (typeof data !== "object" || data === null) {
			throw new Error("Invalid json value");
		}
		return data;
	}

	if (response.body !== null) {
		await response.body.cancel();
	}
	throw new Error(`Unexpected response status ${response.status}`);
}

export class OAuthTokenRequestError extends Error {
	constructor() {
		super("OAuth error");
	}
}
