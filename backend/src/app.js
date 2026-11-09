import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { provider } from "./chain/contracts.js";
import { checkChain } from "./chain/startup.js";
import participantsRoutes from "./api/routes/participants.routes.js";
import chainRoutes from "./api/routes/chain.routes.js";
import txRoutes from "./api/routes/tx.routes.js";
import historyRoutes from "./api/routes/history.routes.js";
import authRoutes from "./api/routes/auth.routes.js";
import batchesRoutes from "./api/routes/batches.routes.js";
import millRoutes from "./api/routes/mill.routes.js";
import storageRoutes from "./api/routes/storage.routes.js";
import exporterRoutes from "./api/routes/exporter.routes.js";
import importerRoutes from "./api/routes/importer.routes.js";
import prepareRoutes from "./api/routes/prepare.routes.js";
import destinationsRoutes from "./api/routes/destinations.routes.js";
import transporterRoutes from "./api/routes/transporter.routes.js";
import receiptRoutes from "./api/routes/receipt.routes.js";
import jobsRoutes from "./api/routes/jobs.routes.js";
import verificationRoutes from "./api/routes/verification.routes.js";
import adminRoutes from "./api/routes/admin.routes.js";
import meRoutes from "./api/routes/me.routes.js";
import applicationsRoutes from "./api/routes/applications.routes.js";
import { errorHandler, notFoundHandler } from "./api/errorHandler.js";
import { allowOrigins } from "./api/cors.js";
import { authRateLimit, requestId } from "./api/security.js";

const app = express();
if (config.TRUST_PROXY > 0) app.set("trust proxy", config.TRUST_PROXY);
app.use(requestId);
if (config.CORS_ORIGIN.length > 0) app.use(allowOrigins(config.CORS_ORIGIN));
app.use(helmet());
app.use("/auth/nonce", authRateLimit());
app.use("/auth/login", authRateLimit());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use(chainRoutes);
app.use(participantsRoutes);
app.use(txRoutes);
app.use(historyRoutes);
app.use(authRoutes);
app.use(batchesRoutes);
app.use(millRoutes);
app.use(storageRoutes);
app.use(exporterRoutes);
app.use(importerRoutes);
app.use(prepareRoutes);
app.use(destinationsRoutes);
app.use(transporterRoutes);
app.use(receiptRoutes);
app.use(jobsRoutes);
app.use(verificationRoutes);
app.use(adminRoutes);
app.use(meRoutes);
app.use(applicationsRoutes);

// Keep every failure — including unknown routes and malformed bodies — in the
// same JSON shape: { error, details? }.
app.use(notFoundHandler);
app.use(errorHandler);

const chainProblems = await checkChain(provider, {
  chainId: config.CHAIN_ID,
  contracts: {
    REGISTRY_ADDRESS: config.REGISTRY_ADDRESS,
    BATCH_CUSTODY_ADDRESS: config.BATCH_CUSTODY_ADDRESS,
  },
});
if (chainProblems.length > 0) {
  console.error(`Backend not started: ${chainProblems.join("; ")}`);
  process.exit(1);
}

app.listen(config.PORT, () => {
  console.log(`Server is running on port ${config.PORT}`);
});
