import { createHmac, timingSafeEqual } from "node:crypto";

const USER_SESSION_COOKIE = "cert_user_session";
const ADMIN_SESSION_COOKIE = "cert_admin_session";

type UserSession = {
  kind: "user";
  qqNumber: string;
  exp: number;
};

type AdminSession = {
  kind: "admin";
  exp: number;
};

type SessionPayload = UserSession | AdminSession;

const getSessionSecret = () =>
  process.env.ADMIN_PASSWORD?.trim() || "local-development-session-secret";

const signValue = (value: string) =>
  createHmac("sha256", getSessionSecret()).update(value).digest("base64url");

const encodeSession = (payload: SessionPayload) => {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signValue(encodedPayload);

  return `${encodedPayload}.${signature}`;
};

const decodeSession = (token?: string | null): SessionPayload | null => {
  if (!token) {
    return null;
  }

  const [encodedPayload, encodedSignature] = token.split(".");

  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(encodedSignature);

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as SessionPayload;

    if (!payload.exp || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

export const parseCookies = (cookieHeader?: string | null) => {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");

    if (!rawName || rawValue.length === 0) {
      continue;
    }

    cookies[rawName] = decodeURIComponent(rawValue.join("="));
  }

  return cookies;
};

const serializeCookie = (name: string, value: string, maxAge: number) => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
};

export const createUserSessionCookie = (qqNumber: string) => {
  const maxAge = 60 * 60 * 24 * 7;
  const payload: UserSession = {
    kind: "user",
    qqNumber,
    exp: Date.now() + maxAge * 1000,
  };

  return serializeCookie(USER_SESSION_COOKIE, encodeSession(payload), maxAge);
};

export const createAdminSessionCookie = () => {
  const maxAge = 60 * 60 * 12;
  const payload: AdminSession = {
    kind: "admin",
    exp: Date.now() + maxAge * 1000,
  };

  return serializeCookie(ADMIN_SESSION_COOKIE, encodeSession(payload), maxAge);
};

export const clearUserSessionCookie = () =>
  serializeCookie(USER_SESSION_COOKIE, "", 0);

export const clearAdminSessionCookie = () =>
  serializeCookie(ADMIN_SESSION_COOKIE, "", 0);

export const getUserSession = (cookieHeader?: string | null) => {
  const cookies = parseCookies(cookieHeader);
  const payload = decodeSession(cookies[USER_SESSION_COOKIE]);

  if (!payload || payload.kind !== "user") {
    return null;
  }

  return payload;
};

export const getAdminSession = (cookieHeader?: string | null) => {
  const cookies = parseCookies(cookieHeader);
  const payload = decodeSession(cookies[ADMIN_SESSION_COOKIE]);

  if (!payload || payload.kind !== "admin") {
    return null;
  }

  return payload;
};
