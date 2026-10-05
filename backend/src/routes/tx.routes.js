import { Router } from "express";
import { decodeTx } from "../chain/reader.js";

const router = Router();

router.get("/tx/:hash", async (req, res) => {
  try {
    const { hash } = req.params;
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      return res.status(400).json({ error: "invalid tx hash" });
    }

    const result = await decodeTx(hash);
    if (!result) {
      return res
        .status(404)
        .json({ error: "transaction not found or not mined yet" });
    }

    const events = result.events.map((e) => ({
      name: e.name,
      args: Object.fromEntries(
        e.args
          .toArray()
          .map((value, i) => [e.args.fragment.inputs[i].name, String(value)]),
      ),
    }));

    res.json({
      hash,
      success: result.success,
      blockNumber: result.blockNumber,
      events,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "chain read failed" });
  }
});

export default router;
