import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import ensureSupabaseSession from "supabase-oauth-popup";
import { bootstrapAlert } from "bootstrap-alert";
import saveform from "saveform";

export default function Auth() {
  // Restore email field on refresh
  useEffect(() => {
    try {
      saveform("#auth-form");
    } catch {}
  }, []);

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  // -----------------------------
  // Magic link login
  // -----------------------------
  const handleMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      bootstrapAlert({
        title: "Login Failed",
        body: error.message,
        color: "danger",
      });
    } else {
      bootstrapAlert({
        title: "Magic Link Sent",
        body: "Check your email to log in!",
        color: "info",
      });
    }

    setLoading(false);
  };

  // -----------------------------
  // OAuth login via Popup (Google / GitHub)
  // -----------------------------
  const handleOAuth = async (provider) => {
    try {
      setLoading(true);

      // Main popup-based login function (from Anand's library)
      const session = await ensureSupabaseSession(supabase, { provider });

      bootstrapAlert({
        title: "Login Successful",
        body: `Signed in as ${session?.user?.email || "user"}!`,
        color: "success",
        replace: true,
      });
    } catch (err) {
      bootstrapAlert({
        title: "Login Failed",
        body: err?.message || String(err),
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container d-flex align-items-center justify-content-center min-vh-100">
      <div className="card shadow-sm" style={{ maxWidth: 420, width: "100%" }}>
        <div className="card-body">
          <h1 className="h4 mb-2 text-center">Case Study Login</h1>
          <p className="text-muted text-center mb-4">
            Sign in to save your progress
          </p>

          {/* --- OAuth Buttons --- */}
          <div className="d-grid gap-2 mb-3">
            <button
              onClick={() => handleOAuth("google")}
              disabled={loading}
              className="btn btn-danger"
            >
              <i className="bi bi-google me-2"></i> Continue with Google
            </button>

            <button
              onClick={() => handleOAuth("github")}
              disabled={loading}
              className="btn btn-dark"
            >
              <i className="bi bi-github me-2"></i> Continue with GitHub
            </button>
          </div>

          <div className="text-center text-muted small my-2">or</div>

          {/* --- Magic Link Form --- */}
          <form id="auth-form" onSubmit={handleMagicLink} className="d-grid gap-2">
            <input
              className="form-control"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Sending link..." : "Send Magic Link"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
