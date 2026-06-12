import { GoogleLogin } from "@react-oauth/google";
import { useStartGoogleLogin } from "../../hooks/useAuth";

// "Continue with Google" using Google Identity Services. Renders nothing when
// VITE_GOOGLE_CLIENT_ID is unset so the rest of the form still works locally.
export function GoogleButton() {
  const google = useStartGoogleLogin();
  const configured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  if (!configured) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        or
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
      <div className="flex justify-center">
        <GoogleLogin
          theme="filled_black"
          text="continue_with"
          shape="pill"
          width="320"
          onSuccess={(res) => {
            if (res.credential) google.mutate(res.credential);
          }}
          onError={() => {
            // GIS surfaces its own UI on failure; nothing to do here.
          }}
        />
      </div>
      {google.error && (
        <p className="text-center text-xs text-[var(--color-danger)]">
          {(google.error as Error).message}
        </p>
      )}
    </div>
  );
}
