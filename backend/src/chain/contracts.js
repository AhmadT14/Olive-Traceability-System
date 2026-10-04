import { readFileSync } from "node:fs";
import { JsonRpcProvider, Contract } from "ethers";
import { config } from "../config.js";

const loadAbi = (name) =>
  JSON.parse(
    readFileSync(new URL(`./abis/${name}.json`, import.meta.url), "utf8"),
  );

export const provider = new JsonRpcProvider(config.RPC_URL, config.CHAIN_ID);

export const registry = new Contract(
  config.REGISTRY_ADDRESS,
  loadAbi("ParticipantRegistry"),
  provider,
);

export const batchCustody = new Contract(
  config.BATCH_CUSTODY_ADDRESS,
  loadAbi("BatchCustody"),
  provider,
);
