import { z } from "zod";

export const bodySchema = z.object({
  url: z
    .string()
    .trim()
    .url()
    .refine((val) => {
      const url = new URL(val);
      return url.protocol === "https:";
    }),
});
