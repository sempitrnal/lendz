import { z } from "zod";

export const borrowerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  contact: z.string().optional(),
});

export type BorrowerFormValues = z.infer<typeof borrowerSchema>;