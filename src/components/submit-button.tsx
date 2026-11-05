"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "default",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} className="h-12 w-full text-base" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function ConfirmForm({
  action,
  message,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
