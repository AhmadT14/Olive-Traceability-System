import jwt from "jsonwebtoken";

export const TOKEN_ALGORITHM = "HS256";
export const TOKEN_ISSUER = "olive-traceability";
export const TOKEN_AUDIENCE = "olive-traceability-api";
export const TOKEN_TTL_SECONDS = 60 * 60;
export const SESSION_MAX_SECONDS = 24 * 60 * 60;

const nowInSeconds = () => Math.floor(Date.now() / 1000);

export function signToken(
  claims,
  secret,
  { authTime, now = nowInSeconds() } = {},
) {
  const auth_time = authTime ?? now;
  return jwt.sign(
    {
      ...claims,
      auth_time,
      iat: now,
      exp: Math.min(now + TOKEN_TTL_SECONDS, auth_time + SESSION_MAX_SECONDS),
    },
    secret,
    {
      algorithm: TOKEN_ALGORITHM,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    },
  );
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret, {
    algorithms: [TOKEN_ALGORITHM],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
}

export function canRefresh(authTime, now = nowInSeconds()) {
  return Number.isInteger(authTime) && now < authTime + SESSION_MAX_SECONDS;
}
