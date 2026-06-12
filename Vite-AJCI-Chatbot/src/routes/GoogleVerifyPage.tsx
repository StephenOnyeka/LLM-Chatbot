import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/ui/Button";
import { OtpInput } from "../components/ui/OtpInput";
import { Spinner } from "../components/ui/Spinner";
import { useVerifyGoogleLogin } from "../hooks/useAuth";

// Location state pushed by useStartGoogleLogin on success.
interface LocationState {
  email?: string;
}

export default function GoogleVerifyPage() {
  const location = useLocation();
  const state = location.state as LocationState | null;
  const email = state?.email ?? "";

  const [code, setCode] = useState("");
  const verify = useVerifyGoogleLogin();

  // If we landed here without an email (e.g. direct navigation), bail out.
  if (!email) {
    return <Navigate to="/login" replace />;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length === 6) {
      verify.mutate({ email, code });
    }
  }

  // Auto-submit once all 6 digits are entered.
  useEffect(() => {
    if (code.length === 6 && !verify.isPending && !verify.isSuccess) {
      verify.mutate({ email, code });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <AuthLayout
      title="Check your inbox"
      subtitle={`We sent a 6-digit sign-in code to ${email}. Enter it below to continue.`}
      footer={
        <Link to="/login" className="text-[var(--color-accent)] hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <OtpInput
          value={code}
          onChange={setCode}
          disabled={verify.isPending || verify.isSuccess}
          error={!!verify.error}
          autoFocus
        />

        {verify.error && (
          <p className="text-center text-sm text-[var(--color-danger)]">
            {(verify.error as Error).message}
          </p>
        )}

        <Button
          type="submit"
          disabled={code.length < 6 || verify.isPending || verify.isSuccess}
          className="w-full"
        >
          {verify.isPending ? <Spinner /> : "Verify & sign in"}
        </Button>

        <p className="text-center text-sm text-[var(--color-text-muted)]">
          Didn&apos;t get the email?{" "}
          <Link
            to="/login"
            className="text-[var(--color-accent)] hover:underline"
          >
            Try again
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
