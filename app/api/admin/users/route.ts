import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UserPermissions = {
  add_program: boolean;
  edit_program: boolean;
  delete_program: boolean;
};

function normalizePermissions(
  permissions: Partial<UserPermissions> | null | undefined,
  role: "admin" | "user"
): UserPermissions {
  if (role === "admin") {
    return {
      add_program: true,
      edit_program: true,
      delete_program: true,
    };
  }

  return {
    add_program: permissions?.add_program === true,
    edit_program: permissions?.edit_program === true,
    delete_program: permissions?.delete_program === true,
  };
}

function getServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function requireAdmin(request: NextRequest) {
  const supabase = getServerClient();

  if (!supabase) {
    return {
      error: NextResponse.json(
        {
          error:
            "Server Supabase configuration incomplete. .env.local में SUPABASE_SERVICE_ROLE_KEY check करें।",
        },
        { status: 500 }
      ),
    };
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.substring(7).trim()
    : "";

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Login session नहीं मिला।" },
        { status: 401 }
      ),
    };
  }

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return {
      error: NextResponse.json(
        { error: "Login session invalid या expire हो गया है।" },
        { status: 401 }
      ),
    };
  }

  const userId = userData.user.id;
  const userEmail = (userData.user.email || "").trim().toLowerCase();

  let { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, role, enabled, permissions")
    .eq("id", userId)
    .maybeSingle();

  if (!profile && userEmail) {
    const fallback = await supabase
      .from("user_profiles")
      .select("id, email, full_name, role, enabled, permissions")
      .ilike("email", userEmail)
      .maybeSingle();

    profile = fallback.data;
    profileError = fallback.error;
  }

  if (profileError) {
    return {
      error: NextResponse.json(
        { error: "Admin profile verify नहीं हो सकी।" },
        { status: 500 }
      ),
    };
  }

  if (
    !profile ||
    profile.role !== "admin" ||
    profile.enabled !== true
  ) {
    return {
      error: NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      ),
    };
  }

  return { supabase, user: userData.user, profile };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.supabase
    .from("user_profiles")
    .select(
      "id, email, full_name, role, enabled, permissions, created_at, updated_at"
    )
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const users = (data || []).map((user) => ({
    ...user,
    permissions: normalizePermissions(
      user.permissions as Partial<UserPermissions> | null,
      user.role === "admin" ? "admin" : "user"
    ),
  }));

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.full_name || "").trim();
    const role = body.role === "admin" ? "admin" : "user";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email और Password जरूरी हैं।" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password कम से कम 6 characters का होना चाहिए।" },
        { status: 400 }
      );
    }

    const { data: created, error: createError } =
      await auth.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message || "User create नहीं हुआ।" },
        { status: 400 }
      );
    }

    const permissions = normalizePermissions(
      body.permissions as Partial<UserPermissions> | null,
      role
    );

    const { data: profile, error: profileError } =
      await auth.supabase
        .from("user_profiles")
        .insert({
          id: created.user.id,
          email,
          full_name: fullName || null,
          role,
          enabled: true,
          permissions,
        })
        .select(
          "id, email, full_name, role, enabled, permissions, created_at"
        )
        .single();

    if (profileError) {
      await auth.supabase.auth.admin.deleteUser(created.user.id);

      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        user: {
          ...profile,
          permissions: normalizePermissions(
            profile.permissions as Partial<UserPermissions> | null,
            role
          ),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.info("Create user error:", error);

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const userId = String(body.id || "");
    const action = String(body.action || "");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID जरूरी है।" },
        { status: 400 }
      );
    }

    if (
      userId === auth.user.id &&
      (action === "disable" || action === "delete" || action === "permissions")
    ) {
      if (action !== "permissions") {
        return NextResponse.json(
          {
            error:
              "आप अपने current admin account को disable/delete नहीं कर सकते।",
          },
          { status: 400 }
        );
      }
    }

    if (action === "permissions") {
      const { data: target, error: targetError } =
        await auth.supabase
          .from("user_profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

      if (targetError || !target) {
        return NextResponse.json(
          { error: "User नहीं मिला।" },
          { status: 404 }
        );
      }

      if (target.role === "admin") {
        return NextResponse.json(
          { error: "Admin User की permissions अलग से बदलने की जरूरत नहीं है।" },
          { status: 400 }
        );
      }

      const permissions = normalizePermissions(
        body.permissions as Partial<UserPermissions> | null,
        "user"
      );

      const { error: updateError } = await auth.supabase
        .from("user_profiles")
        .update({
          permissions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, permissions });
    }

    if (action === "disable" || action === "enable") {
      const enabled = action === "enable";

      const { error: profileError } = await auth.supabase
        .from("user_profiles")
        .update({
          enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (profileError) {
        return NextResponse.json(
          { error: profileError.message },
          { status: 500 }
        );
      }

      const { error: authError } =
        await auth.supabase.auth.admin.updateUserById(userId, {
          ban_duration: enabled ? "none" : "876000h",
        });

      if (authError) {
        return NextResponse.json(
          { error: authError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      const { error: profileError } = await auth.supabase
        .from("user_profiles")
        .delete()
        .eq("id", userId);

      if (profileError) {
        return NextResponse.json(
          { error: profileError.message },
          { status: 500 }
        );
      }

      const { error: authError } =
        await auth.supabase.auth.admin.deleteUser(userId);

      if (authError) {
        return NextResponse.json(
          { error: authError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "reset") {
      const { data: target, error: targetError } =
        await auth.supabase
          .from("user_profiles")
          .select("email")
          .eq("id", userId)
          .maybeSingle();

      if (targetError || !target?.email) {
        return NextResponse.json(
          { error: "User का Email नहीं मिला।" },
          { status: 404 }
        );
      }

      const redirectTo =
        `${new URL(request.url).origin}/reset-password`;

      const { error: resetError } =
        await auth.supabase.auth.resetPasswordForEmail(
          target.email,
          { redirectTo }
        );

      if (resetError) {
        return NextResponse.json(
          { error: resetError.message },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.info("Admin user action error:", error);

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}