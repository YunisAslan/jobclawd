import { z } from "zod";

export const feedFilterSchema = z.object({
  query: z.string().optional(),
  sources: z.array(z.string()).optional(),
  workModes: z.array(z.string()).optional(),
  location: z
    .object({
      type: z.enum(["region", "country", "city"]).optional(),
      value: z.string().optional(),
      values: z.array(z.string()).optional(),
    })
    .optional(),
  experience: z.array(z.string()).optional(),
  datePosted: z.string().optional(),
  salaryMin: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), { message: "Must be a number" }),
  jobTypes: z.array(z.string()).optional(),
  sortBy: z.string().optional(),
});

export type FeedFilterValues = z.infer<typeof feedFilterSchema>;
