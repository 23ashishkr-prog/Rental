"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { actionError, type FormState } from "@/lib/action-error";
import { ConfigError } from "@/lib/errors";
import { isValidEmail } from "@/lib/email";
import { findUserByEmail, findUserById } from "@/lib/queries";
import { setInitialPassword, updatePassword } from "@/lib/mutations";
import { readString } from "@/lib/parse";
import { verifyPassword } from "@/lib/passwords";
import { clearSession, createSession } from "@/lib/session";
import { unstable_rethrow } from "next/navigation";

export type LoginState = {
  step: "email" | "password" | "setup";
  email: string;
  error?: string;
};

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = readString(formData, "intent") || "continue";
  const email = readString(formData, "email");
  const fallback: LoginState["step"] =
    intent === "setup" ? "setup" : intent === "password" ? "password" : "email";

  try {
    if (!isValidEmail(email)) {
      return { step: "email", email, error: "Enter the email address the owner has on file." };
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return {
        step: "email",
        email,
        error: "That email is not on the rent list. Ask the owner to invite you.",
      };
    }

    if (intent === "continue") {
      return { step: user.passwordHash ? "password" : "setup", email: user.email };
    }

    const password = readString(formData, "password");
    if (password.length < 8 || password.length > 200) {
      return {
        step: user.passwordHash ? "password" : "setup",
        email: user.email,
        error: "Use a password of at least 8 characters.",
      };
    }

    if (!user.passwordHash) {
      if (password !== readString(formData, "confirm")) {
        return { step: "setup", email: user.email, error: "The passwords do not match." };
      }
      const saved = await setInitialPassword(user.id, password);
      if (!saved) {
        return { step: "password", email: user.email, error: "A password was already set. Sign in with it." };
      }
      await createSession(user.id);
      redirect("/");
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      return { step: "password", email: user.email, error: "That password is not right." };
    }
    await createSession(user.id);
    redirect("/");
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ConfigError) return { step: fallback, email, error: error.message };
    console.error(error);
    return { step: fallback, email, error: "Something went wrong. Please try again." };
  }
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireUser();
    const user = await findUserById(actor.id);
    if (!user) redirect("/login");
    const next = readString(formData, "password");
    const confirm = readString(formData, "confirm");
    if (next.length < 8 || next.length > 200) return { error: "Use a password of at least 8 characters." };
    if (next !== confirm) return { error: "The passwords do not match." };
    if (user.passwordHash) {
      const current = readString(formData, "current");
      if (!(await verifyPassword(current, user.passwordHash))) {
        return { error: "The current password is not right." };
      }
    }
    await updatePassword(user.id, next);
    return { ok: "Password updated." };
  } catch (error) {
    return actionError(error);
  }
}
