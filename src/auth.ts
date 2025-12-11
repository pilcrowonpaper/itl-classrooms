import * as astro from "astro";
import * as encoding from "@oslojs/encoding";

import { parseGoogleIdToken, type GoogleUser } from "./google-oauth.js";
import { OAuthTokenRequestError, sendOAuthTokenRequest } from "./oauth.js";

export const universityGoogleDomain = "g.chuo-u.ac.jp";

export const googleOAuthCodeVerifierCookieName = "google_oauth_code_verifier";
export const googleRefreshTokenCookieName = "google_refresh_token";
export const googleRefreshTokenSignatureCookieName = "google_refresh_token_signature";
export const googleRefreshTokenSignatureTimestampCookieName =
	"google_refresh_token_signature_timestamp";

export async function signGoogleRefreshToken(
	env: Env,
	googleRefreshToken: string,
	timestampUnix: number,
): Promise<Uint8Array> {
	const data = `${timestampUnix}.${googleRefreshToken}`;
	const dataBytes = new TextEncoder().encode(data);

	const googleRefreshTokenSignatureKey: Uint8Array<any> = encoding.decodeBase64(
		env.GOOGLE_REFRESH_TOKEN_SIGNATURE_KEY,
	);
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		googleRefreshTokenSignatureKey,
		{
			name: "HMAC",
			hash: "SHA-256",
		},
		false,
		["sign"],
	);
	const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes);
	return new Uint8Array(signatureBuffer);
}

export async function verifyGoogleRefreshTokenSignature(
	env: Env,
	signature: Uint8Array<any>,
	googleRefreshToken: string,
	timestampUnix: number,
): Promise<boolean> {
	const data = `${timestampUnix}.${googleRefreshToken}`;
	const dataBytes = new TextEncoder().encode(data);

	const googleRefreshTokenSignatureKey: Uint8Array<any> = encoding.decodeBase64(
		env.GOOGLE_REFRESH_TOKEN_SIGNATURE_KEY,
	);

	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		googleRefreshTokenSignatureKey,
		{
			name: "HMAC",
			hash: "SHA-256",
		},
		false,
		["verify"],
	);
	const signatureValid = await crypto.subtle.verify("HMAC", cryptoKey, signature, dataBytes);
	return signatureValid;
}

export async function validateRequestSession(context: astro.APIContext): Promise<Session | null> {
	const googleRefreshTokenCookie = context.cookies.get(googleRefreshTokenCookieName);
	if (googleRefreshTokenCookie === undefined) {
		return null;
	}
	const googleRefreshToken = googleRefreshTokenCookie.value;

	const validatedSignatureResult = await validateRequestGoogleRefreshTokenSignature(
		context,
		googleRefreshToken,
	);
	if (validatedSignatureResult !== null) {
		const result: Session = {
			googleRefreshToken,
			googleRefreshTokenSignature: validatedSignatureResult.signature,
			googleRefreshTokenSignatureTimestampUnix: validatedSignatureResult.timestampUnix,
		};
		return result;
	}

	const tokenEndpoint = "https://oauth2.googleapis.com/token";
	const tokenRequestBody = new URLSearchParams();
	tokenRequestBody.set("grant_type", "refresh_token");
	tokenRequestBody.set("refresh_token", googleRefreshToken);
	tokenRequestBody.set("client_id", context.locals.runtime.env.GOOGLE_OAUTH_CLIENT_ID);
	tokenRequestBody.set("client_secret", context.locals.runtime.env.GOOGLE_OAUTH_CLIENT_SECRET);

	let tokenRequestResult: object;
	try {
		tokenRequestResult = await sendOAuthTokenRequest(tokenEndpoint, tokenRequestBody);
	} catch (e) {
		if (e instanceof OAuthTokenRequestError) {
			console.log("Google OAuth refresh token error");
			return null;
		}
		throw new Error("Failed to send oauth token request", {
			cause: e,
		});
	}

	if (!("id_token" in tokenRequestResult) || typeof tokenRequestResult.id_token !== "string") {
		throw new Error("Missing or invalid 'id_token' field");
	}

	let googleUser: GoogleUser;
	try {
		googleUser = parseGoogleIdToken(tokenRequestResult.id_token);
	} catch (e) {
		throw new Error("Failed to parse id token", {
			cause: e,
		});
	}

	if (!("id_token" in tokenRequestResult) || typeof tokenRequestResult.id_token !== "string") {
		throw new Error("Missing or invalid 'id_token' field");
	}

	if (googleUser.domain !== universityGoogleDomain) {
		return null;
	}

	const newSignatureTimestampUnix = Math.floor(Date.now() / 1000);
	const newSignature = await signGoogleRefreshToken(
		context.locals.runtime.env,
		googleRefreshToken,
		newSignatureTimestampUnix,
	);

	const result: Session = {
		googleRefreshToken,
		googleRefreshTokenSignature: newSignature,
		googleRefreshTokenSignatureTimestampUnix: newSignatureTimestampUnix,
	};
	return result;
}

export interface Session {
	googleRefreshToken: string;
	googleRefreshTokenSignature: Uint8Array;
	googleRefreshTokenSignatureTimestampUnix: number;
}

async function validateRequestGoogleRefreshTokenSignature(
	context: astro.APIContext,
	googleRefreshToken: string,
): Promise<GoogleRefreshTokenSignatureValidatedResult | null> {
	const signature = getRequestGoogleRefreshTokenSignature(context);
	const timestampUnix = getRequestGoogleRefreshTokenSignatureTimestampUnix(context);
	if (
		signature === null ||
		timestampUnix === null ||
		Date.now() - timestampUnix * 1000 >= 60 * 60 * 1000
	) {
		return null;
	}

	const signatureValid = await verifyGoogleRefreshTokenSignature(
		context.locals.runtime.env,
		signature,
		googleRefreshToken,
		timestampUnix,
	);
	if (!signatureValid) {
		return null;
	}

	const result: GoogleRefreshTokenSignatureValidatedResult = {
		signature,
		timestampUnix,
	};
	return result;
}

export interface GoogleRefreshTokenSignatureValidatedResult {
	signature: Uint8Array;
	timestampUnix: number;
}

function getRequestGoogleRefreshTokenSignature(context: astro.APIContext): Uint8Array | null {
	const cookie = context.cookies.get(googleRefreshTokenSignatureCookieName);
	if (cookie === undefined) {
		return null;
	}

	let signature: Uint8Array;
	try {
		signature = encoding.decodeBase64(cookie.value);
	} catch {
		return null;
	}
	return signature;
}

function getRequestGoogleRefreshTokenSignatureTimestampUnix(
	context: astro.APIContext,
): number | null {
	const cookie = context.cookies.get(googleRefreshTokenSignatureTimestampCookieName);
	if (cookie === undefined) {
		return null;
	}
	if (cookie.value === "0") {
		return 0;
	}

	let timestampUnix = 0;
	for (let i = 0; i < cookie.value.length; i++) {
		const charCode = cookie.value.charCodeAt(i);
		if (i === 0 && charCode === 48) {
			return null;
		}
		if (charCode < 48 || charCode > 57) {
			return null;
		}
		timestampUnix = timestampUnix * 10 + (charCode - 48);
	}
	return timestampUnix;
}

export function setAuthCookies(context: astro.APIContext, session: Session): void {
	setGoogleRefreshTokenCookie(context, session.googleRefreshToken);
	setGoogleRefreshTokenSignatureCookie(context, session.googleRefreshTokenSignature);
	setGoogleRefreshTokenSignatureTimestampCookie(
		context,
		session.googleRefreshTokenSignatureTimestampUnix,
	);
}

export function setGoogleRefreshTokenCookie(
	context: astro.APIContext,
	googleRefreshToken: string,
): void {
	context.cookies.set(googleRefreshTokenCookieName, googleRefreshToken, {
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 100,
		secure: import.meta.env.PROD,
	});
}

export function setGoogleRefreshTokenSignatureCookie(
	context: astro.APIContext,
	signature: Uint8Array,
): void {
	const encoded = encoding.encodeBase64(signature);
	context.cookies.set(googleRefreshTokenSignatureCookieName, encoded, {
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 100,
		secure: import.meta.env.PROD,
	});
}

export function setGoogleRefreshTokenSignatureTimestampCookie(
	context: astro.APIContext,
	timestampUnix: number,
): void {
	context.cookies.set(googleRefreshTokenSignatureTimestampCookieName, timestampUnix.toString(), {
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 100,
		secure: import.meta.env.PROD,
	});
}

export function setBlankAuthCookies(context: astro.APIContext): void {
	context.cookies.set(googleRefreshTokenCookieName, "", {
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		maxAge: 0,
		secure: import.meta.env.PROD,
	});
	context.cookies.set(googleRefreshTokenSignatureCookieName, "", {
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		maxAge: 0,
		secure: import.meta.env.PROD,
	});
	context.cookies.set(googleRefreshTokenSignatureTimestampCookieName, "", {
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		maxAge: 0,
		secure: import.meta.env.PROD,
	});
}
