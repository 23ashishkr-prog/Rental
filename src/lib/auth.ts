import "server-only";
import { redirect } from "next/navigation";
import { flatIdsForUser, findUserById } from "./queries";
import { readSession } from "./session";
import type { Actor } from "./types";

export async function getCurrentUser(): Promise<Actor | null> {
  const session = await readSession();
  if (!session) return null;
  const user = await findUserById(session.uid);
  if (!user) return null;
  const flatIds = user.isAdmin ? [] : await flatIdsForUser(user);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.isAdmin ? "admin" : "tenant",
    isAdmin: user.isAdmin,
    flatIds,
  };
}

export async function requireUser(): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<Actor> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}
