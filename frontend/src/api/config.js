export const API_URL = import.meta.env.VITE_API_URL || "/api";
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337);
export const ADMIN_ADDRESS = (
  import.meta.env.VITE_ADMIN_ADDRESS || ""
).toLowerCase();
