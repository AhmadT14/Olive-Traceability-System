import { config } from "../config.js";
import { verifyToken } from "./tokens.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing token" });
  }

  try {
    const payload = verifyToken(token, config.JWT_SECRET);
    req.user = {
      address: payload.address,
      roles: payload.roles,
      exp: payload.exp,
    };
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}
