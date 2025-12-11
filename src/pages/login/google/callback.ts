import * as astro from "astro";

import {
	googleOAuthCodeVerifierCookieName,
	setAuthCookies,
	signGoogleRefreshToken,
	universityGoogleDomain,
	type Session,
} from "@src/auth.js";
import { OAuthTokenRequestError, sendOAuthTokenRequest } from "@src/oauth.js";
import { parseGoogleIdToken, type GoogleUser } from "@src/google-oauth";

export async function GET(context: astro.APIContext): Promise<Response> {
	const authorizationCode = context.url.searchParams.get("code");
	if (authorizationCode === null) {
		return context.redirect("/login", 303);
	}

	const codeVerifierCookie = context.cookies.get(googleOAuthCodeVerifierCookieName);
	if (codeVerifierCookie === undefined) {
		return context.redirect("/login", 303);
	}

	const tokenEndpoint = "https://oauth2.googleapis.com/token";
	const tokenRequestBody = new URLSearchParams();
	tokenRequestBody.set("grant_type", "authorization_code");
	tokenRequestBody.set("code", authorizationCode);
	tokenRequestBody.set("client_id", context.locals.runtime.env.GOOGLE_OAUTH_CLIENT_ID);
	tokenRequestBody.set("client_secret", context.locals.runtime.env.GOOGLE_OAUTH_CLIENT_SECRET);
	tokenRequestBody.set("redirect_uri", context.locals.runtime.env.GOOGLE_OAUTH_REDIRECT_URI);
	tokenRequestBody.set("code_verifier", codeVerifierCookie.value);

	let tokenRequestResult: object;
	try {
		tokenRequestResult = await sendOAuthTokenRequest(tokenEndpoint, tokenRequestBody);
	} catch (e) {
		if (e instanceof OAuthTokenRequestError) {
			console.log("Google OAuth authorization code error");
			return context.redirect("/login", 303);
		}
		const error = new Error("Failed to send oauth token request", {
			cause: e,
		});
		console.log(error);
		return new Response("予期しないエラーが発生しました。もう一度お試しください。", {
			status: 500,
		});
	}

	if (!("id_token" in tokenRequestResult) || typeof tokenRequestResult.id_token !== "string") {
		const error = new Error("Missing or invalid 'id_token' field");
		console.log(error);
		return new Response("予期しないエラーが発生しました。もう一度お試しください。", {
			status: 500,
		});
	}
	const idToken = tokenRequestResult.id_token;

	if (
		!("refresh_token" in tokenRequestResult) ||
		typeof tokenRequestResult.refresh_token !== "string"
	) {
		const error = new Error("Missing or invalid 'refresh_token' field");
		console.log(error);
		return new Response("予期しないエラーが発生しました。もう一度お試しください。", {
			status: 500,
		});
	}
	const refreshToken = tokenRequestResult.refresh_token;

	let googleUser: GoogleUser;
	try {
		googleUser = parseGoogleIdToken(idToken);
	} catch (e) {
		const error = new Error("Failed to parse id token", {
			cause: e,
		});
		console.log(error);
		return new Response("予期しないエラーが発生しました。もう一度お試しください。", {
			status: 500,
		});
	}

	if (googleUser.domain !== universityGoogleDomain) {
		return new Response("中央大学の Google アカウントでログインしてください。", {
			status: 400,
		});
	}

	const googleRefreshTokenSignatureTimestampUnix = Math.floor(Date.now() / 1000);
	const googleRefreshTokenSignature = await signGoogleRefreshToken(
		context.locals.runtime.env,
		tokenRequestResult.refresh_token,
		googleRefreshTokenSignatureTimestampUnix,
	);

	const session: Session = {
		googleRefreshToken: refreshToken,
		googleRefreshTokenSignature,
		googleRefreshTokenSignatureTimestampUnix,
	};

	setAuthCookies(context, session);
	return context.redirect("/", 303);
}
