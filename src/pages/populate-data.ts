import * as astro from "astro";
import * as encoding from "@oslojs/encoding";

import { setSchedulesJSON } from "@src/schedule";
import { parseNumberString } from "@src/string";

export async function POST(context: astro.APIContext): Promise<Response> {
	const secretHeader = context.request.headers.get("Secret");
	if (secretHeader === null) {
		return new Response(null, {
			status: 401,
		});
	}
	let secret: Uint8Array<any>;
	try {
		secret = encoding.decodeBase64(secretHeader);
	} catch {
		return new Response(null, {
			status: 401,
		});
	}
	if (secret.length !== 32) {
		return new Response(null, {
			status: 401,
		});
	}
	const hashedSecret = await crypto.subtle.digest("SHA-256", secret);
	const hashedSecretBytes = new Uint8Array(hashedSecret);
	const hash = encoding.decodeBase64(context.locals.runtime.env.API_SECRET_HASH);
	const secretCorrect = constantTimeEqual(hashedSecretBytes, hash);
	if (!secretCorrect) {
		return new Response(null, {
			status: 401,
		});
	}

	let bodyText: string;
	try {
		bodyText = await context.request.text();
	} catch {
		return new Response(null, {
			status: 400,
		});
	}

	try {
		await setSchedulesJSON(context.locals.runtime.env, bodyText);
	} catch (e) {
		const error = new Error("Failed to set schedule", {
			cause: e,
		});
		console.log(error);
		return new Response(null, {
			status: 500,
		});
	}

	return new Response(null, {
		status: 201,
	});
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.byteLength !== b.byteLength) {
		return false;
	}
	let c = 0;
	for (let i = 0; i < a.byteLength; i++) {
		c |= a[i] ^ b[i];
	}
	return c === 0;
}
