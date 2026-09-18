"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Program = {
  id: number;
  program_date: string;
  program_time: string;
  title: string;
  sender_name: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  district: string | null;
  state: string | null;
  mobile_number: string | null;
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

const clean = (value: string | null | undefined) =>
  value?.trim() ? value.trim() : "";

export default function ProgramSharePage() {
  const params = useParams<{ id: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadLoading, setDownloadLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProgram = async () => {
      const id = Number(params.id);

      if (!Number.isInteger(id) || id <= 0) {
        if (active) {
          setError("कार्यक्रम ID सही नहीं है।");
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`/api/program/${id}`, {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.program) {
          throw new Error(result.error || "कार्यक्रम नहीं मिला।");
        }

        if (active) setProgram(result.program as Program);
      } catch (requestError) {
        console.error(requestError);
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "कार्यक्रम की जानकारी उपलब्ध नहीं है।"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProgram();

    return () => {
      active = false;
    };
  }, [params.id]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !program) return "";
    return `${window.location.origin}/program/${program.id}`;
  }, [program]);

  const downloadInfo = async () => {
    if (!program) return;

    setDownloadLoading(true);

    try {
      const lines = [
        "दैनिक कार्यक्रम विवरण",
        "==============================",
        `दिनांक: ${formatDate(program.program_date)}`,
        `समय: ${formatTime(program.program_time)}`,
        `कार्यक्रम: ${program.title}`,
        `श्रेणी: ${program.category}`,
        `स्थान: ${program.location}`,
        clean(program.sender_name) ? `प्रेषक: ${program.sender_name}` : "",
        clean(program.address1) ? `पता: ${program.address1}` : "",
        clean(program.address2) ? program.address2 : "",
        clean(program.address3) ? program.address3 : "",
        clean(program.district) ? `जिला: ${program.district}` : "",
        clean(program.state) ? `राज्य: ${program.state}` : "",
        clean(program.mobile_number) ? `मोबाइल: ${program.mobile_number}` : "",
        program.category === "वैवाहिक" && clean(program.groom_name)
          ? `वर: चि. ${program.groom_name}`
          : "",
        program.category === "वैवाहिक" && clean(program.bride_name)
          ? `वधु: सौ.का. ${program.bride_name}`
          : "",
        program.category === "शोक" && clean(program.deceased_name)
          ? `दिवंगत: ${program.deceased_name}`
          : "",
        clean(program.description) ? `विवरण: ${program.description}` : "",
        `कार्यक्रम लिंक: ${shareUrl}`,
      ]
        .filter(Boolean)
        .join("\n");

      const blob = new Blob(["\ufeff", lines], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Program-${program.id}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadLoading(false);
    }
  };

  const shareProgram = async () => {
    if (!program || !shareUrl) return;

    const shareData = {
      title: `कार्यक्रम - ${program.title}`,
      text: `कार्यक्रम की पूरी जानकारी देखें: ${program.title}`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      alert("कार्यक्रम का लिंक clipboard में copy हो गया है।");
    } catch (shareError) {
      if ((shareError as DOMException)?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("कार्यक्रम का लिंक clipboard में copy हो गया है।");
      } catch {
        alert("Share उपलब्ध नहीं है।");
      }
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center text-slate-600">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold">कार्यक्रम की जानकारी लोड हो रही है...</p>
        </div>
      </main>
    );
  }

  if (error || !program) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center max-w-md w-full">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-slate-800">कार्यक्रम नहीं मिला</h1>
          <p className="text-slate-500 mt-3 leading-7">
            {error || "यह कार्यक्रम उपलब्ध नहीं है या हटाया जा चुका है।"}
          </p>
        </div>
      </main>
    );
  }

  const marriage = program.category === "वैवाहिक";
  const condolence = program.category === "शोक";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-600 text-white px-5 py-7 sm:px-8 md:px-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs sm:text-sm font-medium text-blue-100">
                  दैनिक कार्यक्रम प्रबंधन सिस्टम
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold mt-2 leading-tight">
                  कार्यक्रम विवरण
                </h1>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-2xl">
                📋
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-xl sm:text-2xl font-bold leading-snug">
                {program.title}
              </h2>
              <span className="inline-flex mt-3 bg-white/15 border border-white/20 px-3 py-1.5 rounded-full text-sm">
                {program.category}
              </span>
            </div>
          </header>

          <div className="p-5 sm:p-7 md:p-9 space-y-5">
            {program.photo_url && (
              <img
                src={program.photo_url}
                alt="कार्यक्रम फोटो"
                className="w-full max-h-[420px] object-cover rounded-2xl border border-slate-200"
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-xs text-slate-500">दिनांक</p>
                <p className="font-bold mt-1 text-slate-800">
                  📅 {formatDate(program.program_date)}
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-xs text-slate-500">समय</p>
                <p className="font-bold mt-1 text-slate-800">
                  ⏰ {formatTime(program.program_time)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">स्थान</p>
              <p className="font-semibold mt-1 text-slate-800">📍 {program.location}</p>
            </div>

            {program.sender_name && (
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">प्रेषक</p>
                <p className="font-semibold mt-1 text-slate-800">👤 {program.sender_name}</p>
              </div>
            )}

            {(program.address1 || program.address2 || program.address3 || program.district || program.state || program.mobile_number) && (
              <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                <p className="text-xs text-slate-500">संपर्क / पता विवरण</p>
                {program.address1 && <p className="text-sm text-slate-700">{program.address1}</p>}
                {program.address2 && <p className="text-sm text-slate-700">{program.address2}</p>}
                {program.address3 && <p className="text-sm text-slate-700">{program.address3}</p>}
                {program.district && <p className="text-sm text-slate-700">जिला: {program.district}</p>}
                {program.state && <p className="text-sm text-slate-700">राज्य: {program.state}</p>}
                {program.mobile_number && <p className="text-sm text-slate-700">📱 {program.mobile_number}</p>}
              </div>
            )}

            {marriage && (program.groom_name || program.bride_name) && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-xs text-amber-700">वैवाहिक विवरण</p>
                <p className="font-semibold mt-2 text-slate-800 text-lg">
                  {program.groom_name ? `चि. ${program.groom_name}` : ""}
                  {program.groom_name && program.bride_name ? " संग " : ""}
                  {program.bride_name ? `सौ.का. ${program.bride_name}` : ""}
                </p>
              </div>
            )}

            {condolence && program.deceased_name && (
              <div className="rounded-2xl border border-slate-300 bg-slate-50 p-5">
                <p className="text-xs text-slate-500">दिवंगत</p>
                <p className="font-semibold mt-2 text-slate-800 text-lg">{program.deceased_name}</p>
              </div>
            )}

            {program.description && (
              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-xs text-slate-500">विवरण</p>
                <p className="font-medium mt-2 text-slate-800 whitespace-pre-wrap leading-7">
                  {program.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={shareProgram}
                className="w-full px-5 py-3.5 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800"
              >
                📤 कार्यक्रम Share करें
              </button>
              <button
                onClick={downloadInfo}
                disabled={downloadLoading}
                className="w-full px-5 py-3.5 rounded-xl border border-blue-300 bg-white text-blue-700 font-bold hover:bg-blue-50 disabled:opacity-60"
              >
                {downloadLoading ? "डाउनलोड हो रहा है..." : "⬇️ कार्यक्रम विवरण Download करें"}
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500 leading-6">
                यह सार्वजनिक, read-only कार्यक्रम पेज है। यहाँ केवल कार्यक्रम की जानकारी देखी और डाउनलोड/Share की जा सकती है।
                <br />
                <span className="font-semibold">Add, Edit, Update या Delete की कोई अनुमति नहीं है।</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
