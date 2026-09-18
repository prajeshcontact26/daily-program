"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Program = {
  id: number;
  program_date: string;
  program_time: string;
  title: string;
  sender_name: string | null;
  location: string;
  category: string;
  photo_url: string | null;
  description: string | null;
  groom_name: string | null;
  bride_name: string | null;
  deceased_name: string | null;
};

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("hi-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatTime = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour || 0, minute || 0, 0, 0);
  return date.toLocaleTimeString("hi-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export default function ProgramSharePage() {
  const params = useParams<{ id: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProgram = async () => {
      const id = Number(params.id);
      if (!Number.isFinite(id)) {
        setError("कार्यक्रम ID सही नहीं है।");
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from("daily_programs")
        .select("id, program_date, program_time, title, sender_name, location, category, photo_url, description, groom_name, bride_name, deceased_name")
        .eq("id", id)
        .single();

      if (queryError || !data) {
        console.error(queryError);
        setError("यह कार्यक्रम उपलब्ध नहीं है या हटाया जा चुका है।");
      } else {
        setProgram(data as Program);
      }
      setLoading(false);
    };

    loadProgram();
  }, [params.id]);

  const downloadInfo = () => {
    if (!program) return;

    const lines = [
      "कार्यक्रम विवरण",
      "-------------------------",
      `दिनांक: ${formatDate(program.program_date)}`,
      `समय: ${formatTime(program.program_time)}`,
      `कार्यक्रम: ${program.title}`,
      `श्रेणी: ${program.category}`,
      `स्थान: ${program.location}`,
      program.sender_name ? `प्रेषक: ${program.sender_name}` : "",
      program.category === "वैवाहिक" && program.groom_name ? `वर: चि. ${program.groom_name}` : "",
      program.category === "वैवाहिक" && program.bride_name ? `वधु: सौ.का. ${program.bride_name}` : "",
      program.category === "शोक" && program.deceased_name ? `दिवंगत: ${program.deceased_name}` : "",
      program.description ? `विवरण: ${program.description}` : "",
    ].filter(Boolean).join("\n");

    const blob = new Blob(["\ufeff", lines], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Program-${program.id}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6"><div className="bg-white rounded-2xl shadow p-6 text-slate-600">कार्यक्रम लोड हो रहा है...</div></main>;
  }

  if (error || !program) {
    return <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6"><div className="bg-white rounded-2xl shadow p-8 text-center max-w-md"><div className="text-5xl mb-4">⚠️</div><h1 className="text-xl font-bold text-slate-800">कार्यक्रम नहीं मिला</h1><p className="text-slate-500 mt-2">{error}</p></div></main>;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-6 md:p-8">
            <p className="text-sm opacity-90">कार्यक्रम विवरण</p>
            <h1 className="text-2xl md:text-3xl font-bold mt-2">{program.title}</h1>
            <span className="inline-block mt-3 bg-white/15 px-3 py-1 rounded-full text-sm">{program.category}</span>
          </div>

          <div className="p-6 md:p-8 space-y-4">
            {program.photo_url && <img src={program.photo_url} alt="कार्यक्रम फोटो" className="w-full max-h-80 object-cover rounded-2xl border border-slate-200" />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">दिनांक</p><p className="font-bold mt-1">📅 {formatDate(program.program_date)}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">समय</p><p className="font-bold mt-1">⏰ {formatTime(program.program_time)}</p></div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">स्थान</p><p className="font-semibold mt-1">📍 {program.location}</p></div>
            {program.sender_name && <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">प्रेषक</p><p className="font-semibold mt-1">👤 {program.sender_name}</p></div>}
            {program.category === "वैवाहिक" && (program.groom_name || program.bride_name) && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs text-amber-700">वैवाहिक विवरण</p><p className="font-semibold mt-1">चि. {program.groom_name || ""} संग सौ.का. {program.bride_name || ""}</p></div>}
            {program.category === "शोक" && program.deceased_name && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">दिवंगत</p><p className="font-semibold mt-1">{program.deceased_name}</p></div>}
            {program.description && <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">विवरण</p><p className="font-semibold mt-1 whitespace-pre-wrap">{program.description}</p></div>}

            <button onClick={downloadInfo} className="w-full px-5 py-3 rounded-xl bg-blue-700 text-white font-bold hover:bg-blue-800">⬇️ कार्यक्रम विवरण Download करें</button>
            <p className="text-xs text-center text-slate-500">यह पेज QR Code से खोला गया है। कार्यक्रम की जानकारी बाद में भी यहाँ देखी और डाउनलोड की जा सकती है।</p>
          </div>
        </div>
      </div>
    </main>
  );
}