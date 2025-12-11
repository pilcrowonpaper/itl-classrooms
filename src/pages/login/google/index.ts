import * as astro from "astro";
import * as encoding from "@oslojs/encoding";

import { universityGoogleDomain, googleOAuthCodeVerifierCookieName } from "@src/auth.js";

export async function GET(context: astro.APIContext): Promise<Response> {
	const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";

	const scopes = ["openid", "email"];
	const prompts = ["select_account", "consent"];

	const codeVerifier = generateCodeVerifier();

	const codeChallenge = await createCodeChallenge(codeVerifier);

	const searchValues = new URLSearchParams();
	searchValues.set("response_type", "code");
	searchValues.set("client_id", context.locals.runtime.env.GOOGLE_OAUTH_CLIENT_ID);
	searchValues.set("redirect_uri", context.locals.runtime.env.GOOGLE_OAUTH_REDIRECT_URI);
	searchValues.set("code_challenge_method", "S256");
	searchValues.set("code_challenge", codeChallenge);
	searchValues.set("scope", scopes.join(" "));
	searchValues.set("access_type", "offline");
	searchValues.set("prompt", prompts.join(" "));
	searchValues.set("hd", universityGoogleDomain);

	const authorizationURL = authorizationEndpoint + "?" + searchValues.toString();

	context.cookies.set(googleOAuthCodeVerifierCookieName, codeVerifier, {
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		maxAge: 60 * 10,
		secure: import.meta.env.PROD,
	});

	const response = new Response(null, {
		status: 303,
	});
	response.headers.set("Location", authorizationURL);
	return response;
}

function generateCodeVerifier(): string {
	const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";

	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);

	let id = "";
	for (let i = 0; i < bytes.length; i++) {
		id += alphabet[bytes[i] >> 3];
	}
	return id;
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
	const bytes = new TextEncoder().encode(codeVerifier);
	const codeChallengeBuffer = await crypto.subtle.digest("SHA-256", bytes);
	const codeChallenge = encoding.encodeBase64urlNoPadding(new Uint8Array(codeChallengeBuffer));
	return codeChallenge;
}
