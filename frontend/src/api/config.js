export const API_URL = import.meta.env.VITE_API_URL || "/api";
export const USE_MOCKS =
  String(import.meta.env.VITE_USE_MOCKS).trim().toLowerCase() === "true";
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337);
