import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
	id: string;
	email: string;
	name?: string;
	tenantSlug?: string;
	roleId?: string;
	iat?: number;
	exp?: number;
}

function getSessionSecret(): string {
	const secret = process.env.SESSION_SECRET;
	if (!secret) {
		if (process.env.NODE_ENV === "production") {
			throw new Error("SESSION_SECRET environment variable is required in production");
		}
		return "dev-only-insecure-secret-change-me";
	}
	return secret;
}

function hmacSign(data: string): string {
	return createHmac("sha256", getSessionSecret()).update(data).digest("base64url");
}

function hmacVerify(data: string, signature: string): boolean {
	try {
		const expected = hmacSign(data);
		const a = Buffer.from(signature);
		const b = Buffer.from(expected);
		if (a.length !== b.length) return false;
		return timingSafeEqual(a, b);
	} catch {
		return false;
	}
}

export function signSession(payload: SessionPayload): string {
	try {
		const str = JSON.stringify(payload);
		const encoded = typeof Buffer !== "undefined"
			? Buffer.from(str, "utf8").toString("base64url")
			: btoa(str);
		const signature = hmacSign(encoded);
		return `${encoded}.${signature}`;
	} catch (e) {
		return "";
	}
}

export function verifySession(value: string): SessionPayload | null {
	try {
		if (!value) return null;

		// New format: <base64url-payload>.<hmac-signature>
		const dotIdx = value.lastIndexOf(".");
		if (dotIdx > 0) {
			const encoded = value.slice(0, dotIdx);
			const signature = value.slice(dotIdx + 1);
			if (!hmacVerify(encoded, signature)) return null;

			const json = typeof Buffer !== "undefined"
				? Buffer.from(encoded, "base64url").toString("utf8")
				: atob(encoded);
			const payload = JSON.parse(json) as SessionPayload;

			// Check expiry
			if (payload.exp && Date.now() > payload.exp) return null;
			return payload;
		}

		// Legacy fallback: unsigned base64 (for transition period, dev only)
		if (process.env.NODE_ENV !== "production") {
			let json = value;
			if (!json.trim().startsWith("{")) {
				if (typeof Buffer !== "undefined") {
					json = Buffer.from(value, "base64").toString("utf8");
				} else {
					json = atob(value);
				}
			}
			return JSON.parse(json) as SessionPayload;
		}

		return null;
	} catch (e) {
		return null;
	}
}

export function cookieOptions() {
	return {
		name: "syspro_session",
		options: {
			httpOnly: true,
			path: "/",
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
		},
	} as const;
}
