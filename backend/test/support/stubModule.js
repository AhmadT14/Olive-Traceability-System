import { mock } from "node:test";

export function stubModule(path, functionNames, values = {}) {
  const stubs = {};
  const namedExports = { ...values };
  for (const name of functionNames) {
    namedExports[name] = (...args) => stubs[name](...args);
  }
  mock.module(new URL(`../../src/${path}`, import.meta.url).href, {
    namedExports,
  });
  return stubs;
}

export const READER_ROLES = {
  FARMER: "0x01",
  TRANSPORTER: "0x02",
  MILL: "0x03",
  STORAGE: "0x04",
  EXPORTER: "0x05",
  IMPORTER: "0x06",
  RETAILER: "0x07",
};

export function stubReader() {
  return stubModule(
    "chain/reader.js",
    [
      "getBatch",
      "hasRole",
      "hasAdminRole",
      "getBatchCreatedEvents",
      "decodeCustodyTx",
      "decodeRegistryTx",
      "getBatchHistory",
    ],
    { ROLES: READER_ROLES },
  );
}
