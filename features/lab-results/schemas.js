import { z } from "zod";

export const labReportIdSchema = z.string().uuid();
export const observationIdSchema = z.string().uuid();
export const resultValueSchema = z.string().trim().min(1, "مقدار نتیجه الزامی است.");
