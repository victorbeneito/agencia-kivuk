"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError("Email o contraseña incorrectos.");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ width: 320, padding: 24, border: "1px solid #ddd", borderRadius: 8 }}
      >
        <h1 style={{ marginBottom: 24 }}>Iniciar sesión</h1>

        <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            padding: 8,
            marginBottom: 16,
            border: "1px solid #ccc",
            borderRadius: 4,
          }}
        />

        <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: 8,
            marginBottom: 16,
            border: "1px solid #ccc",
            borderRadius: 4,
          }}
        />

        {error && (
          <p style={{ color: "red", marginBottom: 16, fontSize: 14 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 24px",
            background: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
