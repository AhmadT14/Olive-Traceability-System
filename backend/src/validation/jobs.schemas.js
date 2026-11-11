import { z } from "zod";
import { txHashSchema } from "./common.schemas.js";

export const reservationConfirmSchema = z.object({ txHash: txHashSchema });
