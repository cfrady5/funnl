import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEMO_MODE, capabilities } from "@/lib/config";

export const metadata = {
  title: "Sign in · srchr",
};

export default function LoginPage() {
  // Without Supabase configured, the only real path is the sample workspace
  // button. When Supabase IS configured we still show the sample workspace
  // button (always functional) plus a styled, clearly-labeled placeholder form.
  const demoOnly = DEMO_MODE || !capabilities.hasSupabase;

  return (
    <div className="gradient-navy flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" aria-label="srchr home">
            <Logo wordmarkClassName="text-white" />
          </Link>
        </div>

        <Card className="shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              Sign in to srchr
            </CardTitle>
            <CardDescription>
              {demoOnly
                ? "Continue to explore srchr. Connect Supabase to enable saved accounts."
                : "Sign in with your email and password."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {demoOnly ? (
              <>
                <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="text-muted-foreground">
                    Accounts aren&apos;t connected on this instance yet. Continue
                    to run audits now — URL-only audits work without any setup.
                  </p>
                </div>
                <Button asChild size="lg" className="w-full">
                  <Link href="/dashboard">Continue to dashboard</Link>
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Add Supabase credentials to enable saved accounts (see README).
                </p>
              </>
            ) : (
              <LoginForm />
            )}
          </CardContent>

          <CardFooter className="justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to home
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
