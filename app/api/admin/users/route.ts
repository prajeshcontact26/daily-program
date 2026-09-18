import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Permissions = {
  add_program: boolean;
  edit_program: boolean;
  delete_program: boolean;
};

const ALL_PERMISSIONS: Permissions = {
  add_program: true,
  edit_program: true,
  delete_program: true,
};

const DEFAULT_USER_PERMISSIONS: Permissions = {
  add_program: true,
  edit_program: false,
  delete_program: false,
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getAdminClient() {
  if (!supabaseUrl || !serviceKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

async function requireAdmin(request: NextRequest) {
  const supabaseAdmin = getAdminClient();

  if (!supabaseAdmin) {
    return {
      error: json(
        {
          error:
            "Server Supabase configuration incomplete. Vercel Environment Variables में SUPABASE_SERVICE_ROLE_KEY और NEXT_PUBLIC_SUPABASE_URL check करें।",
        },
        500
      ),
      supabaseAdmin: null,
      adminProfile: null,
    };
  }

  const token = getBearerToken(request);

  if (!token) {
    return {
      error: json({ error: "Authentication required." }, 401),
      supabaseAdmin: null,
      adminProfile: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return {
      error: json({ error: "Session expired. Please login again." }, 401),
      supabaseAdmin: null,
      adminProfile: null,
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .select("id, email, full_name, role, enabled, permissions")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Admin profile lookup error:", profileError);
    return {
      error: json({ error: "Admin profile verify नहीं हो सका।" }, 500),
      supabaseAdmin: null,
      adminProfile: null,
    };
  }

  if (!profile) {
    return {
      error: json(
        {
          error:
            "इस account का user profile नहीं मिला। पहले user_profiles में profile बनाएं।",
        },
        403
      ),
      supabaseAdmin: null,
      adminProfile: null,
    };
  }

  if (profile.role !== "admin" || profile.enabled !== true) {
    return {
      error: json({ error: "Admin access required." }, 403),
      supabaseAdmin: null,
      adminProfile: null,
    };
  }

  return {
    error: null,
    supabaseAdmin,
    adminProfile: profile,
  };
}

function normalizePermissions(value: unknown): Permissions {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    add_program: source.add_program === true,
    edit_program: source.edit_program === true,
    delete_program: source.delete_program === true,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);

  if (auth.error) return auth.error;

  const supabaseAdmin = auth.supabaseAdmin!;

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .select(
      "id, email, full_name, role, enabled, created_at, updated_at, permissions"
    )
    .order("created_at", { ascending: true });

  if (profileError) {
    console.error("Users list error:", profileError);
    return json({ error: profileError.message || "Users load नहीं हुए।" }, 500);
  }

  const users = (profiles || []).map((profile) => ({
    ...profile,
    permissions:
      profile.role === "admin"
        ? ALL_PERMISSIONS
        : normalizePermissions(profile.permissions || DEFAULT_USER_PERMISSIONS),
  }));

  return json({ users });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);

  if (auth.error) return auth.error;

  const supabaseAdmin = auth.supabaseAdmin!;

  let body: {
    email?: string;
    full_name?: string;
    password?: string;
    role?: "admin" | "user";
    permissions?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.full_name || "").trim();
  const password = String(body.password || "");
  const role = body.role === "admin" ? "admin" : "user";

  if (!email || !password) {
    return json({ error: "Email और Password जरूरी हैं।" }, 400);
  }

  if (password.length < 6) {
    return json({ error: "Password कम से कम 6 characters का होना चाहिए।" }, 400);
  }

  const permissions =
    role === "admin"
      ? ALL_PERMISSIONS
      : normalizePermissions(body.permissions || DEFAULT_USER_PERMISSIONS);

  const { data: created, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

  if (createError || !created.user) {
    console.error("Create auth user error:", createError);

    const message = createError?.message || "User create नहीं हुआ।";

    if (message.toLowerCase().includes("already")) {
      return json(
        { error: "यह Email पहले से registered है।" },
        409
      );
    }

    return json({ error: message }, 400);
  }

  const authUser = created.user;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .upsert(
      {
        id: authUser.id,
        email,
        full_name: fullName || null,
        role,
        enabled: true,
        permissions,
      },
      { onConflict: "id" }
    )
    .select(
      "id, email, full_name, role, enabled, created_at, updated_at, permissions"
    )
    .single();

  if (profileError) {
    console.error("Create profile error:", profileError);

    // Roll back auth user if profile creation fails.
    await supabaseAdmin.auth.admin.deleteUser(authUser.id);

    return json(
      {
        error:
          "Auth User बन गया लेकिन user profile save नहीं हुई। Operation rollback कर दिया गया।",
      },
      500
    );
  }

  return json(
    {
      message: "User created successfully.",
      user: {
        ...profile,
        permissions:
          role === "admin" ? ALL_PERMISSIONS : normalizePermissions(permissions),
      },
    },
    201
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);

  if (auth.error) return auth.error;

  const supabaseAdmin = auth.supabaseAdmin!;

  let body: {
    id?: string;
    action?: string;
    permissions?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const id = String(body.id || "").trim();
  const action = String(body.action || "").trim().toLowerCase();

  if (!id) {
    return json({ error: "User id जरूरी है।" }, 400);
  }

  if (!action) {
    return json({ error: "Action जरूरी है।" }, 400);
  }

  if (id === auth.adminProfile?.id && ["disable", "delete"].includes(action)) {
    return json(
      { error: "आप अपने current Admin account को disable/delete नहीं कर सकते।" },
      400
    );
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from("user_profiles")
    .select("id, email, full_name, role, enabled, permissions")
    .eq("id", id)
    .maybeSingle();

  if (targetError) {
    console.error("Target profile error:", targetError);
    return json({ error: "Target User verify नहीं हो सका।" }, 500);
  }

  if (!target) {
    return json({ error: "User नहीं मिला।" }, 404);
  }

  // IMPORTANT: this is the action that fixes the current "Unknown action" error.
  if (action === "permissions") {
    if (target.role === "admin") {
      return json(
        { error: "Admin User की permissions हमेशा पूरी रहती हैं।" },
        400
      );
    }

    const permissions = normalizePermissions(body.permissions);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("user_profiles")
      .update({
        permissions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        "id, email, full_name, role, enabled, created_at, updated_at, permissions"
      )
      .single();

    if (updateError) {
      console.error("Permissions update error:", updateError);
      return json(
        { error: updateError.message || "Permissions save नहीं हुईं।" },
        500
      );
    }

    return json({
      message: "Permissions updated successfully.",
      user: updated,
    });
  }

  if (action === "enable" || action === "disable") {
    const enabled = action === "enable";

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("user_profiles")
      .update({
        enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        "id, email, full_name, role, enabled, created_at, updated_at, permissions"
      )
      .single();

    if (updateError) {
      console.error("Enable/disable error:", updateError);
      return json(
        { error: updateError.message || "User status update नहीं हुआ।" },
        500
      );
    }

    return json({
      message: enabled ? "User enabled." : "User disabled.",
      user: updated,
    });
  }

  if (action === "reset") {
    if (!target.email) {
      return json(
        { error: "इस User के लिए email उपलब्ध नहीं है।" },
        400
      );
    }

    const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/reset-password`
      : undefined;

    const { error: resetError } =
      await supabaseAdmin.auth.resetPasswordForEmail(target.email, {
        redirectTo,
      });

    if (resetError) {
      console.error("Reset password error:", resetError);
      return json(
        {
          error:
            resetError.message || "Password reset request भेजी नहीं जा सकी।",
        },
        500
      );
    }

    return json({
      message: "Password reset request sent.",
    });
  }

  if (action === "delete") {
    const { error: deleteAuthError } =
      await supabaseAdmin.auth.admin.deleteUser(id);

    if (deleteAuthError) {
      console.error("Delete auth user error:", deleteAuthError);
      return json(
        {
          error:
            deleteAuthError.message || "Auth User delete नहीं हुआ।",
        },
        500
      );
    }

    const { error: deleteProfileError } = await supabaseAdmin
      .from("user_profiles")
      .delete()
      .eq("id", id);

    if (deleteProfileError) {
      console.error("Delete profile error:", deleteProfileError);
      return json({
        message:
          "Auth User delete हो गया, लेकिन profile cleanup manually verify करें।",
        warning: deleteProfileError.message,
      });
    }

    return json({
      message: "User deleted successfully.",
    });
  }

  return json(
    {
      error: `Unknown action: ${action}`,
    },
    400
  );
}
