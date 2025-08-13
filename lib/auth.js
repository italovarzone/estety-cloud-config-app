import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const CONFIG_JWT_SECRET = process.env.CONFIG_JWT_SECRET;
if (!CONFIG_JWT_SECRET) throw new Error("CONFIG_JWT_SECRET não definido");

export function signAdminToken() {
  return jwt.sign({ role: "admin", sub: "config-admin" }, CONFIG_JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAdminToken(token) {
  try {
    return jwt.verify(token, CONFIG_JWT_SECRET);
  } catch {
    return null;
  }
}

export function setAuthCookie(token) {
  cookies().set("config_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAuthCookie() {
  cookies().set("config_token", "", { httpOnly: true, maxAge: 0, path: "/" });
}

export function getAuthFromCookie() {
  const token = cookies().get("config_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}
