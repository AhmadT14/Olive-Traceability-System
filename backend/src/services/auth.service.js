import { verifyMessage } from "ethers";
import jwt from "jsonwebtoken";
import { buildMessage, consumeNonce, createNonce } from "../auth/nonces.js";
import { config } from "../config.js";
import { AppError, unauthorized, unprocessable } from "../errors.js";
import {
  loginBodySchema,
  nonceBodySchema,
} from "../validation/auth.schemas.js";
import { readRoles } from "./participant.service.js";

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
  try {
    const { address, signature } = parseLoginBody(body);

    const nonce = consumeNonce(address);
    if (!nonce) throw unauthorized("nonce missing or expired");

    const signer = verifyMessage(buildMessage(nonce), signature);
    if (signer.toLowerCase() !== address.toLowerCase()) {
      throw unauthorized("signature does not match address");
    }

    const roles = await readRoles(address);
    const token = jwt.sign({ address, roles }, config.JWT_SECRET, {
      expiresIn: "1h",
    });

    return { address, roles, token };
  } catch (err) {
    // The original endpoint collapsed every unexpected failure (bad signature,
    // expired nonce, chain read) into a 401. Keep that contract.
    if (err instanceof AppError) throw err;
    console.error(err);
    throw unauthorized("login failed");
  }
}

export function createLoginNonce(body) {
  const { address } = parseNonceBody(body);

  const nonce = createNonce(address);
  return { address, nonce, message: buildMessage(nonce) };
}
