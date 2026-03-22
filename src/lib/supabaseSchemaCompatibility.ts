function getErrorParts(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return {
      code: "",
      message: "",
      details: "",
      hint: "",
      name: "",
    };
  }

  const getString = (key: string) => {
    const value = (error as Record<string, unknown>)[key];
    return typeof value === "string" ? value.toLowerCase() : "";
  };

  return {
    code: getString("code"),
    message: getString("message"),
    details: getString("details"),
    hint: getString("hint"),
    name: getString("name"),
  };
}

export function isSchemaCompatibilityError(error: unknown) {
  const { code, message, details, hint, name } = getErrorParts(error);
  const combined = [code, message, details, hint, name].filter(Boolean).join(" ");

  return (
    ["pgrst204", "pgrst205", "42703"].includes(code) ||
    combined.includes("schema cache") ||
    combined.includes("could not find the") ||
    (combined.includes("column") && combined.includes("does not exist")) ||
    combined.includes("unknown column") ||
    combined.includes("unexpected key")
  );
}
