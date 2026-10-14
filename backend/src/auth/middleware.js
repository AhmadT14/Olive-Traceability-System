import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing token" });
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    req.user = { address: payload.address, roles: payload.roles };
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}

export function requireRole(...allowed) {
  return (req, res, next) => {
    const ok = req.user?.roles?.some((r) => allowed.includes(r));
    if (!ok) {
      return res.status(403).json({ error: "role not allowed" });
    }
    next();
  };
}
