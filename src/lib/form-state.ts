import type { ZodError } from "zod";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  success?: string;
};

export const initialFormState: FormState = {};

export function fieldErrorsFrom(error: ZodError, messages: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !result[field]) result[field] = messages[field] ?? "Check this field.";
  }
  return result;
}

export function formValues(form: FormData, fields: string[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field, String(form.get(field) ?? "")]));
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}
