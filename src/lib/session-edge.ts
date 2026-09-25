/**
 * Edge-runtime-safe session verification for middleware.
 *
 * This file must NOT import node:crypto or any Node-only API — the Next.js
 * edge runtime used by middleware only provides WebCrypto (crypto.subtle).
 * Keep it in sync with src/lib/session.ts (same token format and secret).
 */

export interface EdgeSessionPayload {
	id: string;
	email: string;
	name?: string;
	tenantSlug?: string;
	roleId?: string;
	iat?: number;
	exp?: number;
}

async function hmacSha256(key: string, data: string): Promise<Uint8Array> {
	const subtle = globalThis.crypto.subtle;
	const cryptoKey = await subtle.importKey(
		"raw",
		new TextEncoder().encode(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	const signed = await subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
	return new Uint8Array(signed);
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let bin = "";
	for (const byte of bytes) bin += String.fromCharCode(byte);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToString(value: string): string {
	const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
	const bin = atob(padded);
	const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

function timingSafeStringEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

async function getSessionSecret(): Promise<string> {
	const secret = process.env.SESSION_SECRET;
	if (secret) return secret;

	// Must match session.ts fallback: HMAC("pisairtel-session-key", DATABASE_URL)
	const fallback = process.env.DATABASE_URL || "fallback-dev-secret-change-me";
	const derived = await hmacSha256("pisairtel-session-key", fallback);
	return bytesToBase64Url(derived);
}

/**
 * Verify a signed session token (<base64url-payload>.<hmac-signature>).
 * Returns the payload or null. Unsigned/legacy tokens are NOT accepted here.
 */
export async function verifySessionEdge(value: string): Promise<EdgeSessionPayload | null> {
	try {
		if (!value) return null;
		const dotIdx = value.lastIndexOf(".");
		if (dotIdx <= 0) return null;

		const encoded = value.slice(0, dotIdx);
		const signature = value.slice(dotIdx + 1);

		const secret = await getSessionSecret();
		const expectedBytes = await hmacSha256(secret, encoded);
		const expected = bytesToBase64Url(expectedBytes);
		if (!timingSafeStringEqual(signature, expected)) return null;

		const payload = JSON.parse(base64UrlToString(encoded)) as EdgeSessionPayload;
		if (payload.exp && Date.now() > payload.exp) return null;
		return payload;
	} catch {
		return null;
	}
}
