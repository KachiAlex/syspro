export interface SessionPayload {
	id: string;
	email: string;
	name?: string;
	tenantSlug?: string;
	roleId?: string;
	iat?: number;
	exp?: number;
}

export function signSession(payload: SessionPayload): string {
	try {
		const str = JSON.stringify(payload);
		if (typeof Buffer !== "undefined") {
			return Buffer.from(str, "utf8").toString("base64");
		}
		return btoa(str);
	} catch (e) {
		return "";
	}
}

export function verifySession(value: string): SessionPayload | null {
	try {
		if (!value) return null;
		let json = value;
		if (!json.trim().startsWith("{")) {
			if (typeof Buffer !== "undefined") {
				json = Buffer.from(value, "base64").toString("utf8");
			} else {
				json = atob(value);
			}
		}
		return JSON.parse(json) as SessionPayload;
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
