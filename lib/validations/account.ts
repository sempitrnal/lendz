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
        .min(0, "Term cannot be negative"),

    release_date: z.string().min(1, "Release date is required"),

    first_payment_date: z.string(),

    payment_frequency: z.enum(
        ["weekly", "monthly", "bimonthly", "custom"] as const,
        {
            error: "Payment frequency is required",
        }
    ),

    schedule_mode: z.enum(["auto", "manual"] as const),

    interest_type: z.enum(["flat", "rolling"] as const).optional(),
}).superRefine((data, ctx) => {
    if (data.schedule_mode === "auto") {
        if (!data.first_payment_date) {
            ctx.addIssue({
                code: "custom",
                message: "First payment date is required",
                path: ["first_payment_date"],
            });
        }
        if (data.payment_frequency === "custom") {
            if (!Number.isInteger(data.term_months) || data.term_months < 1) {
                ctx.addIssue({
                    code: "custom",
                    message: "Term must be a whole number for custom",
                    path: ["term_months"],
                });
            }
        } else {
            if (data.term_months % 0.5 !== 0) {
                ctx.addIssue({
                    code: "custom",
                    message: "Term must be in 0.5 increments",
                    path: ["term_months"],
                });
            }
        }
    }
});

export type AccountFormValues = z.infer<
    typeof accountSchema
>;
