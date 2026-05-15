import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { useRegister } from "../hooks/useAuth";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const register = useRegister();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
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
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={register.error ? (register.error as Error).message : undefined}
        />
        <Button type="submit" disabled={register.isPending} className="mt-2 w-full">
          {register.isPending ? <Spinner /> : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
