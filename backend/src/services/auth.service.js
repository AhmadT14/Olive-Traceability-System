import { isAddress, verifyMessage } from "ethers";
import jwt from "jsonwebtoken";
import { buildMessage, consumeNonce, createNonce } from "../auth/nonces.js";
import { config } from "../config.js";
import { AppError, badRequest, unauthorized } from "../errors.js";
import { readRoles } from "./participant.service.js";

export async function login(body) {
  try {
    const { address, signature } = body ?? {};

    if (typeof address !== "string" || !isAddress(address)) {
      throw badRequest("invalid address");
    }
    if (typeof signature !== "string") {
      throw badRequest("missing signature");
    }

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
  const { address } = body ?? {};
  if (typeof address !== "string" || !isAddress(address)) {
    throw badRequest("invalid address");
  }

  const nonce = createNonce(address);
  return { address, nonce, message: buildMessage(nonce) };
}
