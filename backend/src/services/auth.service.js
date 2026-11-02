import { verifyMessage } from "ethers";
import jwt from "jsonwebtoken";
import { buildMessage, consumeNonce, createNonce } from "../auth/nonces.js";
import { canRefresh, signToken } from "../auth/tokens.js";
import { config } from "../config.js";
import { serviceUnavailable, unauthorized, unprocessable } from "../errors.js";
import {
  loginBodySchema,
  nonceBodySchema,
} from "../validation/auth.schemas.js";
import { hasAdminRole } from "../chain/reader.js";
import { readRoles } from "./participant.service.js";

// JWT `exp` is in seconds since the epoch; the API reports ISO timestamps.
const expiryOf = (exp) => new Date(exp * 1000).toISOString();

const signInMessage = (address, { nonce, issuedAt, expiresAt }) =>
  buildMessage({
    domain: config.AUTH_DOMAIN,
    uri: config.AUTH_URI,
    address,
    chainId: config.CHAIN_ID,
    nonce,
    issuedAt,
    expiresAt,
  });

// Keeps the endpoint's original wording: a bad address is reported as such,
// and a valid address without a signature reports the missing signature.
function parseLoginBody(body) {
  const parsed = loginBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path?.[0];
    throw unprocessable(
      field === "signature" ? "missing signature" : "invalid address",
      parsed.error.flatten(),
    );
  }
  return parsed.data;
}

function parseNonceBody(body) {
  const parsed = nonceBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw unprocessable("invalid address", parsed.error.flatten());
  }
  return parsed.data;
}

export async function login(body) {
  const { address, signature } = parseLoginBody(body);

  const entry = consumeNonce(address);
  if (!entry) throw unauthorized("nonce missing or expired");

  let signer;
  try {
    signer = verifyMessage(signInMessage(address, entry), signature);
  } catch {
    throw unauthorized("invalid signature");
  }
  if (signer.toLowerCase() !== address.toLowerCase()) {
    throw unauthorized("signature does not match address");
  }

  return issueSession(address, await readChainAccess(address));
}

async function readChainAccess(address) {
  try {
    const [roles, isAdmin] = await Promise.all([
      readRoles(address),
      hasAdminRole(address),
    ]);
    return { roles, isAdmin };
  } catch (err) {
    throw serviceUnavailable("chain unavailable", err);
  }
}

function issueSession(address, { roles, isAdmin }, authTime) {
  const token = signToken({ address, roles }, config.JWT_SECRET, {
    authTime,
  });
  return {
    address,
    roles,
    isAdmin,
    expiresAt: expiryOf(jwt.decode(token).exp),
    token,
  };
}

export async function refreshSession(user) {
  if (!canRefresh(user.authTime)) {
    throw unauthorized("session too old; sign in again");
  }
  return issueSession(
    user.address,
    await readChainAccess(user.address),
    user.authTime,
  );
}

export function createLoginNonce(body) {
  const { address } = parseNonceBody(body);

  const entry = createNonce(address);
  return {
    address,
    nonce: entry.nonce,
    message: signInMessage(address, entry),
  };
}

// Who the bearer token belongs to. The admin flag is read from the registry
// each time, so it follows an admin handover without needing a new login.
export async function getSession(user) {
  const { roles, isAdmin } = await readChainAccess(user.address);
  return {
    address: user.address,
    roles,
    isAdmin,
    expiresAt: expiryOf(user.exp),
  };
}
