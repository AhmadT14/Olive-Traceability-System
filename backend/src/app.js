import express from "express";
import { config } from "./config.js";
import participantsRoutes from "./routes/participants.routes.js";
import chainRoutes from "./routes/chain.routes.js";
import txRoutes from "./routes/tx.routes.js";
import historyRoutes from "./routes/history.routes.js";
import authRoutes from "./routes/auth.routes.js";
import batchesRoutes from "./routes/batches.routes.js";
import millRoutes from "./routes/mill.routes.js";
import storageRoutes from "./routes/storage.routes.js";
import prepareRoutes from "./routes/prepare.routes.js";
import destinationsRoutes from "./routes/destinations.routes.js";
import transporterRoutes from "./routes/transporter.routes.js";
import receiptRoutes from "./routes/receipt.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import verificationRoutes from "./routes/verification.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();
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
app.use(prepareRoutes);
app.use(destinationsRoutes);
app.use(transporterRoutes);
app.use(receiptRoutes);
app.use(jobsRoutes);
app.use(verificationRoutes);
app.use(adminRoutes);

app.listen(config.PORT, () => {
  console.log(`Server is running on port ${config.PORT}`);
});
