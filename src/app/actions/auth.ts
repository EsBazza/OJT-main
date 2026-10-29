"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { meetsPasswordPolicy } from "@/lib/password";
import { createSupabaseServer } from "@/lib/supabase";

const passwordSchema = z.string().refine(meetsPasswordPolicy);

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  studentNumber: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9-]+$/),
  program: z.string().trim().min(2).max(120),
  password: passwordSchema,
});

const registerMessages = {
  name: "Enter your full name (2–100 characters).",
  email: "Enter a valid email address.",
  studentNumber: "Use 3–40 letters, numbers, or dashes.",
  program: "Enter your program (for example, BS Information Technology).",
  password: "The password does not meet every requirement below.",
};

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function supabaseLogin(_state: FormState, form: FormData): Promise<FormState> {
  const values = formValues(form, ["email"]);
  const parsed = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) }).safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { values, fieldErrors: fieldErrorsFrom(parsed.error, { email: "Enter a valid email address.", password: "Enter your password." }) };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    if (error.code === "email_not_confirmed") return { values, error: "Confirm your email address first. Check your inbox for the confirmation link." };
    if (error.code?.includes("rate_limit")) return { values, error: "Too many sign-in attempts. Wait a few minutes and try again." };
    return { values, error: "Email or password is incorrect." };
  }
  redirect("/");
}

export async function supabaseRegister(_state: FormState, form: FormData): Promise<FormState> {
  const values = formValues(form, ["name", "email", "studentNumber", "program"]);
  const parsed = registerSchema.safeParse({ ...values, password: String(form.get("password") ?? "") });
  if (!parsed.success) return { values, fieldErrors: fieldErrorsFrom(parsed.error, registerMessages) };

  if (await prisma.student.findUnique({ where: { studentNumber: parsed.data.studentNumber } })) {
    return { values, fieldErrors: { studentNumber: "This student number is already registered. Sign in with that account instead." } };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name, student_number: parsed.data.studentNumber, program: parsed.data.program } },
  });
  if (!error && data.user && data.user.identities?.length === 0) return { values, fieldErrors: { email: "An account with this email already exists. Sign in instead." } };
  if (error) {
    const code = error.code ?? "unknown";
    console.error("Supabase signup failed", { code, status: error.status });
    if (code.includes("already") || code.includes("exist")) return { values, fieldErrors: { email: "An account with this email already exists. Sign in instead." } };
    if (code.includes("weak_password")) return { values, fieldErrors: { password: "Supabase rejected this password as too weak. Choose a stronger one." } };
    if (code.includes("rate_limit")) return { values, error: "Too many registration attempts. Wait a few minutes and try again." };
    if (code.includes("signup_disabled")) return { values, error: "New registrations are currently disabled. Contact your OJT coordinator." };
    return { values, error: "Registration could not be completed. Try again later or contact your OJT coordinator." };
  }
  return { success: "Account created. If email confirmation is enabled, open the link we sent you, then sign in." };
}
