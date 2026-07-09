"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * Real email/password auth against Supabase. Rendered only when Supabase is
 * configured (the server page branches). Supports sign-in and sign-up in one
 * form; on success we refresh so server components pick up the new session.
 */
export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      setMessage({ kind: "error", text: "Auth isn't configured on this server." });
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage({ kind: "error", text: error.message });
        } else {
          router.push("/dashboard");
          router.refresh();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setMessage({ kind: "error", text: error.message });
        } else if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setMessage({
            kind: "info",
            text: "Check your email to confirm your account, then sign in.",
          });
          setMode("signin");
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>

      {message && (
        <p
          className={
            message.kind === "error"
              ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              : "rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700"
          }
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : mode === "signin" ? (
          <>
            <Lock className="size-4" /> Sign in
          </>
        ) : (
          <>
            <UserPlus className="size-4" /> Create account
          </>
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "signin" ? (
          <>
            New to srchr?{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setMode("signup");
                setMessage(null);
              }}
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setMode("signin");
                setMessage(null);
              }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </form>
  );
}
