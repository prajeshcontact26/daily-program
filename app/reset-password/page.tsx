"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();

        if (!mounted) return;

        if (data.session) {
          setValidSession(true);
        } else {
          setError(
            "Password reset link valid नहीं है या expire हो गया है। Login page से नया reset link भेजें।"
          );
        }
      } catch (err) {
        console.info("Reset session check:", err);
        if (mounted) {
          setError(
            "Password reset link verify नहीं हो सका। कृपया नया link प्राप्त करें।"
          );
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session) {
        setValidSession(true);
        setError("");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError("Password कम से कम 6 characters का होना चाहिए।");
      return;
    }

    if (password !== confirmPassword) {
      setError("दोनों Password समान नहीं हैं।");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({ password });

      if (updateError) {
        console.info("Password update rejected:", updateError.message);
        setError(
          "Password update नहीं हो सका। Reset link expire हो गया हो तो नया link लें।"
        );
        return;
      }

      setSuccess(
        "Password सफलतापूर्वक बदल दिया गया। Login page पर भेजा जा रहा है..."
      );

      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch (err) {
      console.info("Unexpected password update error:", err);
      setError(
        "Password बदलते समय समस्या हुई। कृपया नया reset link प्राप्त करें।"
      );
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="rounded-2xl bg-white px-8 py-7 text-center shadow-xl border border-slate-200">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
          <p className="text-sm font-semibold text-slate-600">
            Reset link verify हो रहा है...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="bg-blue-700 px-6 py-8 text-center text-white">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-extrabold text-blue-700 shadow-lg">
              DP
            </div>
            <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100">
              Government Office System
            </div>
            <h1 className="mt-2 text-2xl font-extrabold">
              Password बदलें
            </h1>
            <p className="mt-1 text-xs text-blue-100">
              Daily Program Management System
            </p>
          </div>

          <form onSubmit={handleUpdatePassword} className="px-6 py-7">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-800">
                नया Password सेट करें
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                अपने account के लिए नया सुरक्षित Password दर्ज करें।
              </p>
            </div>

            {!validSession && error ? (
              <>
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold leading-5 text-red-700"
                >
                  ⚠️ {error}
                </div>

                <button
                  type="button"
                  onClick={() => router.replace("/login")}
                  className="mt-5 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white hover:bg-blue-800"
                >
                  ← Login पर जाएँ
                </button>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="newPassword"
                      className="mb-1.5 block text-xs font-bold text-slate-700"
                    >
                      नया Password
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="कम से कम 6 characters"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="mb-1.5 block text-xs font-bold text-slate-700"
                    >
                      Password दोबारा दर्ज करें
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) =>
                        setConfirmPassword(e.target.value)
                      }
                      placeholder="Password confirm करें"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      disabled={loading}
                    />
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-700"
                  >
                    ⚠️ {error}
                  </div>
                )}

                {success && (
                  <div
                    role="status"
                    className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3.5 py-3 text-xs font-semibold text-green-700"
                  >
                    ✓ {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-5 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Password बदल रहा है..." : "🔐 Password बदलें"}
                </button>

                <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
                  Password कम से कम 6 characters का रखें।
                </p>
              </>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
