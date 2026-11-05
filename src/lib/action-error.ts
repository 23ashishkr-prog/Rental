import { unstable_rethrow } from "next/navigation";
import { AppError, ConfigError } from "./errors";

export type FormState = { error?: string; ok?: string } | null;

export function actionError(error: unknown): FormState {
  unstable_rethrow(error);
  if (error instanceof AppError || error instanceof ConfigError) {
    return { error: error.message };
  }
  console.error(error);
  return { error: "Something went wrong. Please try again." };
}
