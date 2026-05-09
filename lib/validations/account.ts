import { z } from "zod";

export const accountSchema = z.object({
    borrower_id: z.string().uuid("Invalid borrower"),

    type: z.enum(["loan", "cash_advance"] as const, {
        error: "Account type is required",
    }),

    principal_amount: z
        .number("Principal amount is required")
        .positive("Principal amount must be greater than 0"),

    interest_rate: z
        .number("Interest rate must be a number")
        .min(0, "Interest rate cannot be negative")
        .max(100, "Interest rate cannot exceed 100%"),

    term_months: z
        .number("Term is required")
        .int("Term must be a whole number")
        .positive("Term must be greater than 0"),

    release_date: z.string().min(1, "Release date is required"),

    first_payment_date: z
        .string()
        .min(1, "First payment date is required"),

    payment_frequency: z.enum(
        ["weekly", "monthly", "custom"] as const,
        {
            error: "Payment frequency is required",
        }
    ),
});

export type AccountFormValues = z.infer<
    typeof accountSchema
>;
