"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();

        if (!mounted) return;

        if (data.session) {
          router.replace("/");
          return;
        }
      } catch (err) {
        console.info("Session check error:", err);
      } finally {
        if (mounted) setCheckingSession(false);
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace("/");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError("");
    setSuccess("");

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setError("कृपया Email और Password दोनों भरें।");
      return;
    }

    setLoading(true);

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) {
        console.info("Login rejected:", loginError.message);
        const message = loginError.message.toLowerCase();

        if (
          message.includes("invalid login credentials") ||
          message.includes("invalid credentials")
        ) {
          setError("Email या Password गलत है। कृपया दोबारा जाँच करें।");
        } else if (message.includes("email not confirmed")) {
          setError("इस Email की पुष्टि अभी नहीं हुई है।");
        } else if (message.includes("too many requests")) {
          setError("बहुत अधिक प्रयास हुए हैं। कुछ समय बाद फिर प्रयास करें।");
        } else {
          setError(`Login नहीं हो सका: ${loginError.message}`);
        }
        return;
      }

      setSuccess("Login सफल हो गया। Dashboard खोला जा रहा है...");
      router.replace("/");
    } catch (err) {
      console.info("Unexpected login error:", err);
      setError("Login के दौरान समस्या हुई। कृपया फिर से प्रयास करें।");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (forgotLoading) return;

    setForgotMessage("");
    setError("");

    const cleanEmail = forgotEmail.trim();

    if (!cleanEmail) {
      setForgotMessage("कृपया अपना Email दर्ज करें।");
      return;
    }

    setForgotLoading(true);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo,
        });

      if (resetError) {
        console.info("Password reset request:", resetError.message);
        setForgotMessage(
          "Password reset email भेजा नहीं जा सका। कृपया Email जाँचें और फिर प्रयास करें।"
        );
        return;
      }

      setForgotMessage(
        "Password reset link आपके Email पर भेज दिया गया है। Inbox/Spam folder जाँचें।"
      );
    } catch (err) {
      console.info("Unexpected password reset error:", err);
      setForgotMessage(
        "Password reset के दौरान समस्या हुई। कृपया कुछ समय बाद फिर प्रयास करें।"
      );
    } finally {
      setForgotLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="rounded-2xl bg-white px-8 py-7 text-center shadow-xl border border-slate-200">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
          <p className="text-sm font-semibold text-slate-600">
            Login verify हो रहा है...
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
              दैनिक कार्यक्रम प्रबंधन
            </h1>

            <p className="mt-1 text-xs font-medium text-blue-100">
              Daily Program Management System
            </p>

            <div className="mx-auto mt-5 h-px w-20 bg-blue-300/60" />
            <p className="mt-3 text-[11px] text-blue-100">
              अधिकृत उपयोगकर्ताओं के लिए सुरक्षित लॉगिन
            </p>
          </div>

          {!showForgot ? (
            <form onSubmit={handleLogin} className="px-6 py-7">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-800">
                  Sign in
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Dashboard access करने के लिए अपना account विवरण दर्ज करें।
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-bold text-slate-700"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="example@email.com"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    disabled={loading}
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-xs font-bold text-slate-700"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgot(true);
                        setForgotEmail(email);
                        setError("");
                        setSuccess("");
                      }}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      Password भूल गए?
                    </button>
                  </div>

                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="अपना Password दर्ज करें"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-700"
                  >
                    ⚠️ {error}
                  </div>
                )}

                {success && (
                  <div
                    role="status"
                    className="rounded-xl border border-green-200 bg-green-50 px-3.5 py-3 text-xs font-semibold text-green-700"
                  >
                    ✓ {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-blue-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Login हो रहा है..." : "🔐 Login"}
                </button>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5 text-center">
                <p className="text-[11px] font-medium text-slate-400">
                  Authorized users only • Secure Access
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="px-6 py-7">
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot(false);
                    setForgotMessage("");
                  }}
                  className="mb-4 text-xs font-semibold text-blue-700 hover:underline"
                >
                  ← वापस Login पर जाएँ
                </button>

                <h2 className="text-lg font-bold text-slate-800">
                  Password Reset
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  अपना registered Email दर्ज करें। आपको Password बदलने के लिए
                  सुरक्षित link भेजा जाएगा।
                </p>
              </div>

              <div>
                <label
                  htmlFor="forgotEmail"
                  className="mb-1.5 block text-xs font-bold text-slate-700"
                >
                  Registered Email
                </label>
                <input
                  id="forgotEmail"
                  type="email"
                  autoComplete="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  disabled={forgotLoading}
                />
              </div>

              {forgotMessage && (
                <div
                  role="status"
                  className={`mt-4 rounded-xl border px-3.5 py-3 text-xs font-semibold ${
                    forgotMessage.includes("भेज दिया")
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {forgotMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotLoading}
                className="mt-5 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {forgotLoading
                  ? "Reset Link भेजा जा रहा है..."
                  : "✉️ Reset Link भेजें"}
              </button>

              <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
                Email न मिले तो Spam / Junk folder भी जाँचें।
              </p>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] font-medium text-slate-400">
          Daily Program Management System
        </p>
      </div>
    </main>
  );
}
