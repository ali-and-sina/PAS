import { z } from "zod";

export const labReportIdSchema = z.string().uuid();
export const observationIdSchema = z.string().uuid();
export const resultValueSchema = z
  .string()
  .trim()
  .min(1, "مقدار نتیجه الزامی است.");

export const bulkResultRowSchema = z.object({
  test_key: z.string().trim().min(1, "شناسه تست الزامی است."),
  value: z.string().trim().min(1, "مقدار نتیجه الزامی است."),
});

export const bulkResultRowsSchema = z
  .array(bulkResultRowSchema)
  .min(1, "حداقل یک نتیجه وارد کنید.")
  .max(500, "تعداد نتایج واردشده بیش از حد مجاز است.");
