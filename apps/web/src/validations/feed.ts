import { z } from "zod";

export const feedFilterSchema = z.object({
  query: z.string().min(1, "Enter a job title or keyword to search"),
  sources: z.array(z.string()).optional(),
  workModes: z.array(z.string()).optional(),
  location: z
    .object({
      type: z.enum(["region", "country", "city"]).nullish(),
      value: z.string().nullish(),
      values: z.array(z.string()).nullish(),
    })
    .nullish(),
  experience: z.array(z.string()).optional(),
  datePosted: z.string().optional(),
  salaryMin: z
    .string()
    .optional()
    .refine((v) => !v || /^[\d,]+$/.test(v), { message: "Must be a number" }),
  salaryPeriod: z.enum(["annual", "monthly", "hourly"]).optional(),
  jobTypes: z.array(z.string()).optional(),
  sortBy: z.string().optional(),
});

export type FeedFilterValues = z.infer<typeof feedFilterSchema>;
