"use client";

import { useState } from "react";
import {
  formFieldInputClassName,
  formFieldLabelClassName,
} from "@/lib/form-field-classes";
import { loginAction } from "@/app/actions/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    if (isLoading) return;
    setError(null);
    setIsLoading(true);

    try {
      const result = await loginAction(email, password);

      if (!result.error) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  return (
    <div className="grid min-h-[70vh] w-full place-items-center">
      <form
        className="flex w-full max-w-md flex-col gap-4 rounded-md p-4 py-8 shadow-md"
        onSubmit={(e) => {
          e.preventDefault();
          login();
        }}
      >
        <h1 className="mb-4 text-center">Utangz</h1>

        <div>
          <label htmlFor="login-email" className={formFieldLabelClassName}>
            email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={formFieldInputClassName}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="login-password" className={formFieldLabelClassName}>
            password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className={formFieldInputClassName}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="rounded-md bg-stone-900 p-2 text-white transition-colors enabled:cursor-pointer enabled:hover:bg-stone-800 disabled:opacity-70"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  className="opacity-25"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
                />
              </svg>
              Logging in...
            </span>
          ) : (
            "Login"
          )}
        </button>
      </form>
    </div>
  );
}
