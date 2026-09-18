import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: idParam } = await context.params;
    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "कार्यक्रम ID सही नहीं है।" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !secretKey) {
      console.error("Public program API: Supabase server environment missing.");
      return NextResponse.json(
        { error: "Server configuration incomplete." },
        { status: 500 }
      );
    }

    // This client exists only on the server. The secret key is never sent
    // to the browser. The endpoint is read-only and returns only the
    // information needed for the public QR program page.
    const supabase = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase
      .from("daily_programs")
      .select(
        "id, program_date, program_time, title, sender_name, mobile_number, location, category, photo_url, description, groom_name, bride_name, deceased_name"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Public program API query error:", error);
      return NextResponse.json(
        { error: "कार्यक्रम की जानकारी प्राप्त नहीं हो सकी।" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "यह कार्यक्रम उपलब्ध नहीं है या हटाया जा चुका है।" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { program: data },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Public program API unexpected error:", error);
    return NextResponse.json(
      { error: "कार्यक्रम की जानकारी लोड नहीं हो सकी।" },
      { status: 500 }
    );
  }
}
