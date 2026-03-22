import { describe, expect, it } from "vitest";
import { formatSupabaseError, isSchemaCompatibilityError } from "@/lib/supabaseSchemaCompatibility";

describe("isSchemaCompatibilityError", () => {
  it("detects postgrest schema cache errors from details", () => {
    expect(
      isSchemaCompatibilityError({
        code: "PGRST204",
        details: "Could not find the 'payment_provider' column of 'orders' in the schema cache",
      })
    ).toBe(true);
  });

  it("detects postgres missing column errors", () => {
    expect(
      isSchemaCompatibilityError({
        code: "42703",
        message: 'column "destination_lat" does not exist',
      })
    ).toBe(true);
  });

  it("ignores unrelated request errors", () => {
    expect(
      isSchemaCompatibilityError({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      })
    ).toBe(false);
  });
});


describe("formatSupabaseError", () => {
  it("joins message, details, hint, and code when present", () => {
    expect(
      formatSupabaseError({
        message: "Insert failed",
        details: "row violates policy",
        hint: "Check auth",
        code: "42501",
      })
    ).toBe("Insert failed · row violates policy · Check auth · 42501");
  });

  it("falls back for unknown errors", () => {
    expect(formatSupabaseError(null)).toBe("Failed to place order");
  });
});
