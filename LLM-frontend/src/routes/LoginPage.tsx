import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../components/auth/AuthLayout";
import { GoogleButton } from "../components/auth/GoogleButton";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Spinner } from "../components/ui/Spinner";
import { useLogin } from "../hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue your conversations."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="text-[var(--color-accent)] hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={login.error ? (login.error as Error).message : undefined}
        />
        <div className="-mt-1 text-right text-sm">
          <Link
            to="/forgot-password"
            className="text-[var(--color-accent)] hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" disabled={login.isPending} className="mt-2 w-full">
          {login.isPending ? <Spinner /> : "Sign in"}
        </Button>
        <GoogleButton />
      </form>
    </AuthLayout>
  );
}
