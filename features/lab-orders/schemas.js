import { z } from "zod";

export const labOrderStatusSchema = z.enum(["pending", "received_by_lab", "in_progress", "completed", "cancelled"]);
export const labOrderIdSchema = z.string().uuid();
