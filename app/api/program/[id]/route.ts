import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) return null;

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = getServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Server Supabase configuration incomplete." },
      { status: 500 }
    );
  }

  const { id } = await context.params;
  const programId = Number(id);

  if (!Number.isInteger(programId) || programId <= 0) {
    return NextResponse.json(
      { error: "कार्यक्रम ID सही नहीं है।" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("daily_programs")
    .select(
      "id, program_date, program_time, title, sender_name, address1, address2, address3, district, state, mobile_number, location, category, photo_url, description, groom_name, bride_name, deceased_name"
    )
    .eq("id", programId)
    .maybeSingle();

  if (error) {
    console.error("Public program lookup failed:", error.message);
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
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
