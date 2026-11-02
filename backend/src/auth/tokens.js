import jwt from "jsonwebtoken";

export const TOKEN_ALGORITHM = "HS256";
export const TOKEN_ISSUER = "olive-traceability";
export const TOKEN_AUDIENCE = "olive-traceability-api";
const TOKEN_TTL = "1h";

export function signToken(claims, secret) {
  return jwt.sign(claims, secret, {
    algorithm: TOKEN_ALGORITHM,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    expiresIn: TOKEN_TTL,
  });
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret, {
    algorithms: [TOKEN_ALGORITHM],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
}
