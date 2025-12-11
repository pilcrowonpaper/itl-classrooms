import * as encoding from "@oslojs/encoding";

import { OAuthTokenRequestError, sendOAuthTokenRequest } from "./oauth.js";

export function parseGoogleIdToken(idToken: string): GoogleUser {
	const idTokenParts = idToken.split(".");
	if (idTokenParts.length !== 3) {
		throw new Error("Invalid id token");
	}
	const payloadJSONBytes = encoding.decodeBase64urlIgnorePadding(idTokenParts[1]);
	const payloadJSON = new TextDecoder().decode(payloadJSONBytes);

	const payloadJSONObject: unknown = JSON.parse(payloadJSON);
	if (typeof payloadJSONObject !== "object" || payloadJSONObject === null) {
		throw new Error("Invalid json value");
	}

	if (!("sub" in payloadJSONObject) || typeof payloadJSONObject.sub !== "string") {
		throw new Error("Missing or invalid 'sub' field");
	}
	let domain: string | null = null;
	if ("hd" in payloadJSONObject) {
		if (typeof payloadJSONObject.hd !== "string") {
			throw new Error("Invalid 'hd' field");
		}
		domain = payloadJSONObject.hd;
	}

	const user: GoogleUser = {
		id: payloadJSONObject.sub,
		domain: domain,
	};
	return user;
}

export interface GoogleUser {
	id: string;
	domain: string | null;
}

export async function validateGoogleOAuthAuthorizationCode(
	env: Env,
	authorizationCode: string,
	codeVerifier: string,
): Promise<GoogleAuthorizationCodeValidationResult> {
	const tokenEndpoint = "https://oauth2.googleapis.com/token";
	const tokenRequestBody = new URLSearchParams();
	tokenRequestBody.set("grant_type", "authorization_code");
	tokenRequestBody.set("code", authorizationCode);
	tokenRequestBody.set("client_id", env.GOOGLE_OAUTH_CLIENT_ID);
	tokenRequestBody.set("client_secret", env.GOOGLE_OAUTH_CLIENT_SECRET);
	tokenRequestBody.set("redirect_uri", env.GOOGLE_OAUTH_REDIRECT_URI);
	tokenRequestBody.set("code_verifier", codeVerifier);

	let tokenRequestResult: object;
	try {
		tokenRequestResult = await sendOAuthTokenRequest(tokenEndpoint, tokenRequestBody);
	} catch (e) {
		if (e instanceof OAuthTokenRequestError) {
			throw new OAuthTokenRequestError();
		}
		throw new Error("Failed to send oauth token request", {
			cause: e,
		});
	}

	if (!("id_token" in tokenRequestResult) || typeof tokenRequestResult.id_token !== "string") {
		throw new Error("Missing or invalid 'id_token' field");
	}

	if (
		!("refresh_token" in tokenRequestResult) ||
		typeof tokenRequestResult.refresh_token !== "string"
	) {
		throw new Error("Missing or invalid 'refresh_token' field");
	}

	const result: GoogleAuthorizationCodeValidationResult = {
		idToken: tokenRequestResult.id_token,
		refreshToken: tokenRequestResult.refresh_token,
	};
	return result;
}

export interface GoogleAuthorizationCodeValidationResult {
	idToken: string;
	refreshToken: string;
}

export async function validateGoogleOAuthRefreshToken(
	env: Env,
	refreshToken: string,
): Promise<string> {
	const tokenEndpoint = "https://oauth2.googleapis.com/token";
	const tokenRequestBody = new URLSearchParams();
	tokenRequestBody.set("grant_type", "refresh_token");
	tokenRequestBody.set("refresh_token", refreshToken);
	tokenRequestBody.set("client_id", env.GOOGLE_OAUTH_CLIENT_ID);
	tokenRequestBody.set("client_secret", env.GOOGLE_OAUTH_CLIENT_SECRET);

	let tokenRequestResult: object;
	try {
		tokenRequestResult = await sendOAuthTokenRequest(tokenEndpoint, tokenRequestBody);
	} catch (e) {
		if (e instanceof OAuthTokenRequestError) {
			throw new OAuthTokenRequestError();
		}
		throw new Error("Failed to send oauth token request", {
			cause: e,
		});
	}

	if (!("id_token" in tokenRequestResult) || typeof tokenRequestResult.id_token !== "string") {
		throw new Error("Missing or invalid 'id_token' field");
	}

	return tokenRequestResult.id_token;
}
