import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-foreground">Welcome</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your account or create a new one
          </p>
        </div>
        <Suspense>
          <AuthForm />
        </Suspense>
      </div>
    </div>
  );
}

