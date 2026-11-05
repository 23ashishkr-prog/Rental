"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/server/auth-actions";
import { Field, FormMessage, controlClass } from "@/components/ui-bits";
import { SubmitButton } from "@/components/submit-button";

const initial: LoginState = { step: "email", email: "" };

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initial);
  const step = state.step;

  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          readOnly={step !== "email"}
          className={controlClass}
        />
      </Field>
      {step !== "email" ? (
        <Field label={step === "setup" ? "Choose a password" : "Password"} htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={step === "setup" ? "new-password" : "current-password"}
            required
            minLength={8}
            className={controlClass}
          />
        </Field>
      ) : null}
      {step === "setup" ? (
        <Field label="Confirm password" htmlFor="confirm" hint="First visit for this email. After this, only the password can sign in.">
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={controlClass}
          />
        </Field>
      ) : null}
      <FormMessage state={state.error ? { error: state.error } : null} />
      <input type="hidden" name="intent" value={step === "email" ? "continue" : step} />
      <SubmitButton pendingLabel={step === "email" ? "Checking…" : "Signing in…"}>
        {step === "email" ? "Continue" : step === "setup" ? "Save password and sign in" : "Sign in"}
      </SubmitButton>
      {step !== "email" ? (
        <a href="/login" className="block text-center text-sm font-medium text-primary">
          Use a different email
        </a>
      ) : null}
    </form>
  );
}
