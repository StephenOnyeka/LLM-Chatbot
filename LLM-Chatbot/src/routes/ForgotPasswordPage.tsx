import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { OtpInput } from "../components/ui/OtpInput";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Spinner } from "../components/ui/Spinner";
import { useForgotPassword, useResetPassword } from "../hooks/useAuth";

type Step = "request" | "verify";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const forgot = useForgotPassword();
  const reset = useResetPassword();

  function onRequest(e: FormEvent) {
    e.preventDefault();
    forgot.mutate(email, {
      onSuccess: () => setStep("verify"),
    });
  }

  function onReset(e: FormEvent) {
    e.preventDefault();
    if (code.length === 6) {
      reset.mutate({ email, code, password });
    }
  }

  const backToLogin = (
    <Link to="/login" className="text-[var(--color-accent)] hover:underline">
      Back to sign in
    </Link>
  );

  if (step === "request") {
    return (
      <AuthLayout
        title="Forgot your password?"
        subtitle="Enter your email and we'll send you a reset code."
        footer={backToLogin}
      >
        <form onSubmit={onRequest} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={forgot.error ? (forgot.error as Error).message : undefined}
          />
          <Button type="submit" disabled={forgot.isPending} className="mt-2 w-full">
            {forgot.isPending ? <Spinner /> : "Send reset code"}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Enter your reset code"
      subtitle={`We sent a 6-digit code to ${email}. Enter it below with your new password.`}
      footer={backToLogin}
    >
      <form onSubmit={onReset} className="flex flex-col gap-5">
        <OtpInput
          value={code}
          onChange={setCode}
          disabled={reset.isPending || reset.isSuccess}
          error={!!reset.error}
          autoFocus
        />
        <PasswordInput
          label="New password"
          name="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={reset.error ? (reset.error as Error).message : undefined}
        />
        <Button
          type="submit"
          disabled={code.length < 6 || password.length < 6 || reset.isPending}
          className="w-full"
        >
          {reset.isPending ? <Spinner /> : "Reset password"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setCode("");
            forgot.reset();
            setStep("request");
          }}
          className="text-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Didn't get a code? Resend
        </button>
      </form>
    </AuthLayout>
  );
}

