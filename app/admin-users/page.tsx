"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type UserPermissions = {
  add_program: boolean;
  edit_program: boolean;
  delete_program: boolean;
};

type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "user";
  enabled: boolean;
  created_at: string;
  updated_at?: string;
  permissions?: UserPermissions | null;
};

type UserAction = "enable" | "disable" | "delete" | "reset";

const defaultUserPermissions: UserPermissions = {
  add_program: true,
  edit_program: false,
  delete_program: false,
};

const adminPermissions: UserPermissions = {
  add_program: true,
  edit_program: true,
  delete_program: true,
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");

  const [permissionUser, setPermissionUser] = useState<UserProfile | null>(null);
  const [permissionDraft, setPermissionDraft] =
    useState<UserPermissions>(defaultUserPermissions);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.enabled).length,
      admins: users.filter((u) => u.role === "admin").length,
    }),
    [users]
  );

  const clearStatus = () => {
    setError("");
    setMessage("");
  };

  const getSession = async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error("Session प्राप्त नहीं हो सकी।");
    }

    if (!data.session) {
      router.replace("/login");
      return null;
    }

    return data.session;
  };

  const loadUsers = async () => {
    setLoading(true);
    clearStatus();

    try {
      const session = await getSession();
      if (!session) return;

      const response = await fetch("/api/admin/users", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        setError(
          "इस account को Admin access नहीं है। Dashboard पर वापस भेजा जा रहा है।"
        );
        setTimeout(() => router.replace("/"), 900);
        return;
      }

      if (!response.ok) {
        setError(result.error || "Users load नहीं हो सके।");
        return;
      }

      setUsers(Array.isArray(result.users) ? result.users : []);
    } catch (err) {
      console.error("Load users error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Users load करते समय समस्या हुई।"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (working) return;

    setWorking(true);
    clearStatus();

    try {
      const session = await getSession();
      if (!session) return;

      const permissions =
        role === "admin" ? adminPermissions : defaultUserPermissions;

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim(),
          password,
          role,
          permissions,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        setError(result.error || "User create नहीं हुआ।");
        return;
      }

      setMessage("नया User सफलतापूर्वक बनाया गया।");
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("user");
      setShowCreate(false);

      await loadUsers();
    } catch (err) {
      console.error("Create user error:", err);
      setError("User create करते समय समस्या हुई।");
    } finally {
      setWorking(false);
    }
  };

  const userAction = async (id: string, action: UserAction) => {
    if (working) return;

    const target = users.find((u) => u.id === id);
    if (!target) return;

    if (action === "delete") {
      const confirmed = window.confirm(
        `${target.email || "इस User"} को permanently delete करना है?`
      );
      if (!confirmed) return;
    }

    setWorking(true);
    clearStatus();

    try {
      const session = await getSession();
      if (!session) return;

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, action }),
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        setError(result.error || "Action complete नहीं हुआ।");
        return;
      }

      const messages: Record<UserAction, string> = {
        enable: "User enable कर दिया गया।",
        disable: "User disable कर दिया गया।",
        delete: "User delete कर दिया गया।",
        reset: "Password reset request सफलतापूर्वक भेजी गई।",
      };

      setMessage(messages[action]);
      await loadUsers();
    } catch (err) {
      console.error("User action error:", err);
      setError("Action complete करते समय समस्या हुई।");
    } finally {
      setWorking(false);
    }
  };

  const openPermissions = (user: UserProfile) => {
    if (user.role === "admin") return;

    setPermissionUser(user);
    setPermissionDraft({
      add_program: user.permissions?.add_program === true,
      edit_program: user.permissions?.edit_program === true,
      delete_program: user.permissions?.delete_program === true,
    });
    clearStatus();
  };

  const savePermissions = async () => {
    if (!permissionUser || permissionUser.role === "admin" || working) {
      return;
    }

    setWorking(true);
    clearStatus();

    try {
      const session = await getSession();
      if (!session) return;

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: permissionUser.id,
          action: "permissions",
          permissions: {
            add_program: permissionDraft.add_program === true,
            edit_program: permissionDraft.edit_program === true,
            delete_program: permissionDraft.delete_program === true,
          },
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        setError(result.error || "Permissions save नहीं हुईं।");
        return;
      }

      setPermissionUser(null);
      setMessage("User permissions सफलतापूर्वक save हो गईं।");
      await loadUsers();
    } catch (err) {
      console.error("Save permissions error:", err);
      setError("Permissions save करते समय समस्या हुई।");
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-sm font-extrabold text-white">
              DP
            </div>
            <div>
              <h1 className="text-lg font-extrabold">User Management</h1>
              <p className="text-[11px] text-slate-500">
                दैनिक कार्यक्रम प्रबंधन — Admin Panel
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
          >
            ← Dashboard
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            ⚠️ {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            ✓ {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">कुल Users</p>
            <p className="mt-2 text-3xl font-extrabold text-blue-700">
              {stats.total}
            </p>
          </div>

          <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">
              Active Users
            </p>
            <p className="mt-2 text-3xl font-extrabold text-green-600">
              {stats.active}
            </p>
          </div>

          <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Admins</p>
            <p className="mt-2 text-3xl font-extrabold text-purple-600">
              {stats.admins}
            </p>
          </div>
        </div>

        <section className="mt-5 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-extrabold">Authorized Users</h2>
              <p className="mt-1 text-xs text-slate-500">
                केवल Admin इस सूची को manage कर सकता है।
              </p>
            </div>

            <button
              onClick={() => {
                setShowCreate(true);
                clearStatus();
              }}
              disabled={working}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              + नया User
            </button>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
              ⏳ Users load हो रहे हैं...
            </div>
          ) : users.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
              कोई User नहीं मिला।
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Permissions</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => {
                    const permissions =
                      user.role === "admin"
                        ? adminPermissions
                        : user.permissions || defaultUserPermissions;

                    return (
                      <tr key={user.id} className="border-t border-slate-100">
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-800">
                            {user.full_name || "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {user.email || "—"}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              user.role === "admin"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {user.role === "admin" ? "Admin" : "User"}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              user.enabled
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {user.enabled ? "Active" : "Disabled"}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                            <span
                              className={`rounded-full px-2 py-1 ${
                                permissions.add_program
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              Add {permissions.add_program ? "✓" : "—"}
                            </span>
                            <span
                              className={`rounded-full px-2 py-1 ${
                                permissions.edit_program
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              Edit {permissions.edit_program ? "✓" : "—"}
                            </span>
                            <span
                              className={`rounded-full px-2 py-1 ${
                                permissions.delete_program
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              Delete {permissions.delete_program ? "✓" : "—"}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {user.role === "user" && (
                              <button
                                onClick={() => openPermissions(user)}
                                disabled={working}
                                className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-60"
                              >
                                Permissions
                              </button>
                            )}

                            {user.enabled ? (
                              <button
                                onClick={() =>
                                  userAction(user.id, "disable")
                                }
                                disabled={working}
                                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                              >
                                Disable
                              </button>
                            ) : (
                              <button
                                onClick={() => userAction(user.id, "enable")}
                                disabled={working}
                                className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-50 disabled:opacity-60"
                              >
                                Enable
                              </button>
                            )}

                            <button
                              onClick={() => userAction(user.id, "reset")}
                              disabled={working}
                              className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                            >
                              Reset Password
                            </button>

                            <button
                              onClick={() => userAction(user.id, "delete")}
                              disabled={working}
                              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {permissionUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-6 py-5">
              <h2 className="text-lg font-bold text-slate-800">
                User Permissions
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {permissionUser.full_name || "User"} •{" "}
                {permissionUser.email || ""}
              </p>
            </div>

            <div className="space-y-3 px-6 py-5">
              <p className="text-sm font-semibold text-slate-700">
                इस User को कौन-कौन सी अनुमति देनी है?
              </p>

              {[
                ["add_program", "➕ नया कार्यक्रम Add करना"],
                ["edit_program", "✏️ कार्यक्रम Edit करना"],
                ["delete_program", "🗑️ कार्यक्रम Delete करना"],
              ].map(([key, label]) => {
                const permissionKey = key as keyof UserPermissions;

                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
                  >
                    <span className="text-sm font-semibold text-slate-700">
                      {label}
                    </span>

                    <input
                      type="checkbox"
                      checked={permissionDraft[permissionKey]}
                      onChange={(event) =>
                        setPermissionDraft((current) => ({
                          ...current,
                          [permissionKey]: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 cursor-pointer accent-blue-700"
                    />
                  </label>
                );
              })}

              <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
                Admin User को सभी permissions हमेशा उपलब्ध रहेंगी।
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button
                type="button"
                onClick={() => setPermissionUser(null)}
                disabled={working}
                className="rounded-lg border px-4 py-2 text-sm font-bold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={savePermissions}
                disabled={working}
                className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {working ? "Saving..." : "Save Permissions"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-extrabold">नया User बनाएँ</h2>
              <p className="mt-1 text-xs text-slate-500">
                User को Login के लिए Email और Password मिलेगा।
              </p>
            </div>

            <form onSubmit={createUser} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-bold">Name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
                  placeholder="User का नाम"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">
                  Temporary Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
                  placeholder="कम से कम 6 characters"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Role</label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value === "admin" ? "admin" : "user")
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {role === "user" ? (
                <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
                  Default: Add अनुमति ON, Edit/Delete OFF. बाद में Permissions
                  से बदली जा सकती हैं।
                </div>
              ) : (
                <div className="rounded-xl bg-purple-50 p-3 text-xs text-purple-700">
                  Admin को Add, Edit और Delete सभी permissions मिलेंगी।
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  disabled={working}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={working}
                  className="flex-1 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {working ? "Create हो रहा है..." : "User Create करें"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
