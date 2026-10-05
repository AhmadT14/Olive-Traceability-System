import express from "express";
import { config } from "./config.js";
import participantsRoutes from "./routes/participants.routes.js";
import chainRoutes from "./routes/chain.routes.js";
import txRoutes from "./routes/tx.routes.js";
import historyRoutes from "./routes/history.routes.js";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use(chainRoutes);
app.use(participantsRoutes);
app.use(txRoutes);
app.use(historyRoutes);

app.listen(config.PORT, () => {
  console.log(`Server is running on port ${config.PORT}`);
});
