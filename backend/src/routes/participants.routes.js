import { Router } from "express";
import { isAddress } from "ethers";
import { hasRole, ROLES } from "../chain/reader.js";

const router = Router();

router.get("/participants/:address/roles", async (req, res) => {
  try {
    const { address } = req.params;
    if (!isAddress(address)) {
      return res.status(400).json({ error: "invalid address" });
    }

    const names = Object.keys(ROLES);
    const results = await Promise.all(
      names.map((name) => hasRole(name, address)),
    );
    const roles = names.filter((_, i) => results[i]);

    res.json({ address, roles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "chain read failed" });
  }
});

export default router;
