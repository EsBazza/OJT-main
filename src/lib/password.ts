export const passwordRules = [
  { test: (value: string) => value.length >= 10, label: "At least 10 characters" },
  { test: (value: string) => /[a-z]/.test(value), label: "A lowercase letter" },
  { test: (value: string) => /[A-Z]/.test(value), label: "An uppercase letter" },
  { test: (value: string) => /[0-9]/.test(value), label: "A number" },
  { test: (value: string) => /[^A-Za-z0-9\s]/.test(value), label: "A special character" },
];

export function meetsPasswordPolicy(value: string): boolean {
  return value.length <= 128 && passwordRules.every((rule) => rule.test(value));
}
