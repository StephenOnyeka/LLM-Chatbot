import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../components/auth/AuthLayout";
import { GoogleButton } from "../components/auth/GoogleButton";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Spinner } from "../components/ui/Spinner";
import { useRegister } from "../hooks/useAuth";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const register = useRegister();

  const mismatch = confirm.length > 0 && confirm !== password;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) return;
    register.mutate({ name, email, password });
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start chatting in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-[var(--color-accent)] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Name"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={register.error ? (register.error as Error).message : undefined}
        />
        <PasswordInput
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? "Passwords do not match" : undefined}
        />
        <Button
          type="submit"
          disabled={register.isPending || mismatch || confirm.length === 0}
          className="mt-2 w-full"
        >
          {register.isPending ? <Spinner /> : "Create account"}
        </Button>
        <GoogleButton />
      </form>
    </AuthLayout>
  );
}
