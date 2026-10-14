import { Router } from "express";
import { isAddress, verifyMessage } from "ethers";
import { createNonce, consumeNonce, buildMessage } from "../auth/nonces.js";
import { hasRole, ROLES } from "../chain/reader.js";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { address, signature } = req.body ?? {};
    if (typeof address !== "string" || !isAddress(address)) {
      return res.status(400).json({ error: "invalid address" });
    }
    if (typeof signature !== "string") {
      return res.status(400).json({ error: "missing signature" });
    }

    const nonce = consumeNonce(address);
    if (!nonce) {
      return res.status(401).json({ error: "nonce missing or expired" });
    }

    const signer = verifyMessage(buildMessage(nonce), signature);
    if (signer.toLowerCase() !== address.toLowerCase()) {
      return res
        .status(401)
        .json({ error: "signature does not match address" });
    }

    const names = Object.keys(ROLES);
    const results = await Promise.all(names.map((n) => hasRole(n, address)));
    const roles = names.filter((_, i) => results[i]);

    const token = jwt.sign({ address, roles }, config.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ address, roles, token });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "login failed" });
  }
});

router.post("/auth/nonce", (req, res) => {
  const { address } = req.body ?? {};
  if (typeof address !== "string" || !isAddress(address)) {
    return res.status(400).json({ error: "invalid address" });
  }

  const nonce = createNonce(address);
  res.json({ address, nonce, message: buildMessage(nonce) });
});

export default router;
