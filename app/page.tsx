"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

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

type ExcelPreviewRow = {
  rowNumber: number;
  program_date: string;
  program_time: string;
  title: string;
  category: string;
  groom_name: string;
  bride_name: string;
  deceased_name: string;
  location: string;
  sender_name: string;
  address1: string;
  address2: string;
  district: string;
  state: string;
  mobile_number: string;
  description: string;
  valid: boolean;
  error: string;
};

const emptyForm = {
  date: "",
  time: "",
  title: "",
  sender_name: "",
  address1: "",
  address2: "",
  address3: "",
  district: "",
  state: "",
  mobile_number: "",
  location: "",
  category: "नागरिक भेंट",
  description: "",
  groom_name: "",
  bride_name: "",
  deceased_name: "",
};

export default function Home() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedDate, setSelectedDate] = useState("");

  // STEP 7.9 - Excel Import के बाद Calendar को imported data वाले
  // महीने पर automatically ले जाने के लिए।
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date();
    return new Date(
      current.getFullYear(),
      current.getMonth(),
      1
    );
  });


  const [search, setSearch] = useState("");

  const [activeView, setActiveView] = useState<
    "dashboard" | "today" | "upcoming" | "past"
  >("dashboard");

  // STEP 7.4
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState(emptyForm);

  // STEP 7.6 - PHOTO UPLOAD
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [existingPhotoUrl, setExistingPhotoUrl] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelRows, setExcelRows] = useState<ExcelPreviewRow[]>([]);
  const [excelPreview, setExcelPreview] = useState<ExcelPreviewRow[]>([]);
  const [excelTotalRows, setExcelTotalRows] = useState(0);
  const [excelInvalidRows, setExcelInvalidRows] = useState(0);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelImportProgress, setExcelImportProgress] = useState(0);
  const [excelImportSuccess, setExcelImportSuccess] = useState(0);
  const [excelImportErrorRows, setExcelImportErrorRows] = useState(0);
  const [excelError, setExcelError] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // DATE-WISE PDF REPORT
  const [pdfLoading, setPdfLoading] = useState(false);

  // =========================================================
  // TODAY
  // =========================================================

  const getToday = () => {
    const today = new Date();

    return [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
  };

  const today = getToday();

  // =========================================================
  // INITIAL DATE
  // =========================================================

  useEffect(() => {
    setSelectedDate(today);

    setForm({
      ...emptyForm,
      date: today,
    });
  }, [today]);

  // =========================================================
  // LOAD PROGRAMS
  // =========================================================
  // यह function केवल database data load करता है।
  // selectedDate और calendarMonth को यह कभी बदलता नहीं है।

  const loadPrograms = async () => {
    setLoading(true);
    setError("");

    try {
      const pageSize = 1000;
      let allRows: Program[] = [];
      let from = 0;

      while (true) {
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from("daily_programs")
          .select("*")
          .order("program_date", { ascending: true })
          .order("program_time", { ascending: true })
          .range(from, to);

        if (error) {
          console.error("Load programs error:", error);
          throw error;
        }

        const rows = (data || []) as Program[];
        allRows = [...allRows, ...rows];

        if (rows.length < pageSize) break;

        from += pageSize;
      }

      setPrograms(allRows);

    } catch (error) {
      console.error(error);
      setError("कार्यक्रम data load नहीं हो सका।");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrograms();
  }, []);

  // =========================================================
  // FORMAT FUNCTIONS
  // =========================================================

  const formatDate = (date: string) => {
    if (!date) return "";

    return new Date(date + "T00:00:00").toLocaleDateString("hi-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatShortDate = (date: string) => {
    if (!date) return "";

    return new Date(date + "T00:00:00").toLocaleDateString("hi-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (time: string) => {
    if (!time) return "";

    const [hourString, minuteString] = time.split(":");

    const hour = Number(hourString);
    const minute = Number(minuteString);

    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${String(displayHour).padStart(2, "0")}:${String(
      minute
    ).padStart(2, "0")} ${suffix}`;
  };

  // =========================================================
  // PROGRAM LISTS
  // =========================================================

  const todayPrograms = programs
    .filter((program) => program.program_date === today)
    .sort((a, b) => a.program_time.localeCompare(b.program_time));

  const upcomingPrograms = programs
    .filter((program) => program.program_date > today)
    .sort((a, b) => {
      if (a.program_date !== b.program_date) {
        return a.program_date.localeCompare(b.program_date);
      }

      return a.program_time.localeCompare(b.program_time);
    });

  const pastPrograms = programs
    .filter((program) => program.program_date < today)
    .sort((a, b) => {
      if (a.program_date !== b.program_date) {
        return b.program_date.localeCompare(a.program_date);
      }

      return b.program_time.localeCompare(a.program_time);
    });

  // =========================================================
  // SELECTED DATE PROGRAMS
  // =========================================================

  const selectedPrograms = useMemo(() => {
    return programs
      .filter((program) => program.program_date === selectedDate)
      .filter((program) => {
        const text =
          `${program.title} ${program.location} ${program.category}`.toLowerCase();

        return text.includes(search.toLowerCase());
      })
      .sort((a, b) => a.program_time.localeCompare(b.program_time));
  }, [programs, selectedDate, search]);

  // =========================================================
  // ALL PROGRAMS FOR SELECTED DATE (PDF)
  // Search filter से अलग रखा गया है ताकि PDF में उस तारीख के
  // सभी कार्यक्रम आएं।
  // =========================================================

  const selectedDatePrograms = useMemo(() => {
    return programs
      .filter((program) => program.program_date === selectedDate)
      .sort((a, b) => a.program_time.localeCompare(b.program_time));
  }, [programs, selectedDate]);

  // =========================================================
  // DASHBOARD COUNTS
  // =========================================================

  const citizenCount = todayPrograms.filter(
    (program) => program.category === "नागरिक भेंट"
  ).length;

  const officeCount = todayPrograms.filter(
    (program) => program.category === "कार्यालयीन कार्य"
  ).length;

  const meetingCount = todayPrograms.filter(
    (program) => program.category === "बैठक"
  ).length;

  // =========================================================
  // CHANGE VIEW
  // =========================================================

  const changeView = (
    view: "dashboard" | "today" | "upcoming" | "past"
  ) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  // =========================================================
  // ADD
  // =========================================================

  const openAddForm = () => {
    setEditingId(null);

    setForm({
      ...emptyForm,
      date: selectedDate || today,
    });

    setSelectedPhoto(null);
    setPhotoPreview("");
    setExistingPhotoUrl("");

    setShowForm(true);
    setMobileMenuOpen(false);
  };

  // =========================================================
  // EDIT
  // =========================================================

  const openEditForm = (program: Program) => {
    setEditingId(program.id);

    setForm({
      date: program.program_date,
      time: program.program_time.slice(0, 5),
      title: program.title,
      sender_name: program.sender_name || "",
      address1: program.address1 || "",
      address2: program.address2 || "",
      address3: program.address3 || "",
      district: program.district || "",
      state: program.state || "",
      mobile_number: program.mobile_number || "",
      location: program.location,
      category: program.category,
      description: program.description || "",
      groom_name: program.groom_name || "",
      bride_name: program.bride_name || "",
      deceased_name: program.deceased_name || "",
    });

    setSelectedPhoto(null);
    setPhotoPreview(program.photo_url || "");
    setExistingPhotoUrl(program.photo_url || "");

    setShowForm(true);
  };

  // =========================================================
  // PHOTO SELECT
  // =========================================================

  const handlePhotoChange = (file: File | null) => {
    if (!file) {
      setSelectedPhoto(null);
      setPhotoPreview(existingPhotoUrl || "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("कृपया केवल image file चुनें।");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Photo का size 5 MB से कम रखें।");
      return;
    }

    setSelectedPhoto(file);

    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  // =========================================================
  // SAVE / UPDATE
  // =========================================================


  // =========================================================
  // STEP 7.8 - EXCEL IMPORT / PREVIEW
  // =========================================================

  const normalizeExcelCategory = (value: unknown) => {
    const category = String(value ?? "").trim();

    const categoryMap: Record<string, string> = {
      "वैवाहिक": "वैवाहिक",
      "शोक": "शोक",
      "शोक कार्यक्रम": "शोक",
      "शासकीय": "शासकीय",
      "पार्टी": "पार्टी",
      "धार्मिक": "धार्मिक",
      "नागरिक भेंट": "नागरिक भेंट",
      "कार्यालयीन कार्य": "कार्यालयीन कार्य",
      "कार्यक्रम": "कार्यक्रम",
      "बैठक": "बैठक",
      "दौरा": "दौरा",
      "निरीक्षण": "निरीक्षण",
      "अन्य संस्था": "अन्य",
      "अन्य": "अन्य",
      "": "अन्य",
    };

    return categoryMap[category] || "अन्य";
  };

  const excelDateToString = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "";

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, "0"),
        String(value.getDate()).padStart(2, "0"),
      ].join("-");
    }

    if (typeof value === "number") {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return [
          parsed.y,
          String(parsed.m).padStart(2, "0"),
          String(parsed.d).padStart(2, "0"),
        ].join("-");
      }
    }

    const raw = String(value).trim();
    if (!raw) return "";

    const dmy = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    }

    const ymd = raw.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
    if (ymd) {
      return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return [
        parsed.getFullYear(),
        String(parsed.getMonth() + 1).padStart(2, "0"),
        String(parsed.getDate()).padStart(2, "0"),
      ].join("-");
    }

    return "";
  };

  const excelTimeToString = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "";

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${String(value.getHours()).padStart(2, "0")}:${String(
        value.getMinutes()
      ).padStart(2, "0")}:00`;
    }

    if (typeof value === "number") {
      const fraction = value % 1;
      const totalSeconds = Math.round(fraction * 24 * 60 * 60);
      const hours = Math.floor(totalSeconds / 3600) % 24;
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}:${String(seconds).padStart(2, "0")}`;
    }

    const raw = String(value).trim();
    if (!raw) return "";

    const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}:${
        match[3] || "00"
      }`;
    }

    return "";
  };

  const excelText = (value: unknown) => {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  };

  const getExcelValue = (
    row: Record<string, unknown>,
    names: string[]
  ) => {
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(row, name)) {
        return row[name];
      }
    }
    return "";
  };

  const openExcelImport = () => {
    setExcelFile(null);
    setExcelRows([]);
    setExcelPreview([]);
    setExcelTotalRows(0);
    setExcelInvalidRows(0);
    setExcelImportProgress(0);
    setExcelImportSuccess(0);
    setExcelImportErrorRows(0);
    setExcelError("");
    setExcelImportOpen(true);
    setMobileMenuOpen(false);
  };

  const closeExcelImport = () => {
    if (excelLoading || excelImporting) return;
    setExcelImportOpen(false);
  };

  const handleExcelSelect = async (file: File | null) => {
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(extension || "")) {
      setExcelError("कृपया केवल Excel (.xlsx या .xls) file चुनें।");
      return;
    }

    setExcelFile(file);
    setExcelLoading(true);
    setExcelError("");
    setExcelPreview([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("Excel में कोई worksheet नहीं मिली।");
      }

      const sheet = workbook.Sheets[firstSheetName];

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: true,
      });

      if (!rows.length) {
        throw new Error("Excel में कोई data नहीं मिला।");
      }

      const previewRows: ExcelPreviewRow[] = rows.map((row, index) => {
        const rawCategory = excelText(
          getExcelValue(row, ["कार्यक्रम का प्रकार", "कार्यक्रम का प्रकार "])
        );
        const category = normalizeExcelCategory(rawCategory);

        const programDate = excelDateToString(
          getExcelValue(row, ["दिनांक", "Date", "date"])
        );

        const programTime = excelTimeToString(
          getExcelValue(row, ["टाइम", "समय", "Time", "time"])
        );

        const title =
          excelText(
            getExcelValue(row, [
              "कार्यक्रम का विवरण",
              "कार्यक्रम",
              "विवरण",
            ])
          ) || "कार्यक्रम";

        const location =
          excelText(getExcelValue(row, ["स्थान", "कार्यक्रम का स्थान"])) ||
          "स्थान उपलब्ध नहीं";

        const marriageName = excelText(
          getExcelValue(row, [
            "वर  संग  वधु का नाम",
            "वर संग वधु का नाम",
          ])
        );

        const deceasedName = excelText(
          getExcelValue(row, [
            "दिवंगत व्यक्ति का नाम",
            "दिवंगत व्यक्ति का नाम ",
            "मृतक व्यक्ति का नाम",
          ])
        );

        const errorParts: string[] = [];

        if (!programDate) errorParts.push("दिनांक नहीं मिली");
        if (!programTime) errorParts.push("समय नहीं मिला");

        return {
          rowNumber: index + 2,
          program_date: programDate,
          program_time: programTime,
          title,
          category,
          groom_name: category === "वैवाहिक" ? marriageName : "",
          bride_name: "",
          deceased_name: category === "शोक" ? deceasedName : "",
          location,
          sender_name: excelText(
            getExcelValue(row, [
              "आमंत्रण कर्ता /  व्यक्ति का नाम",
              "आमंत्रण कर्ता / व्यक्ति का नाम",
              "प्रेषक का नाम",
            ])
          ),
          address1: excelText(
            getExcelValue(row, ["आमंत्रण कर्ता का पता", "पता"])
          ),
          address2: excelText(
            getExcelValue(row, ["आमंत्रण कर्ता का पता 2", "पता 2"])
          ),
          district: excelText(getExcelValue(row, ["Jila", "जिला"])),
          state: excelText(getExcelValue(row, ["State", "राज्य"])),
          mobile_number: excelText(
            getExcelValue(row, ["फ़ोन नंबर", "फोन नंबर", "Mobile Number"])
          ),
          description: excelText(
            getExcelValue(row, ["Column 18", "अतिरिक्त विवरण", "विवरण"])
          ),
          valid: errorParts.length === 0,
          error: errorParts.join(", "),
        };
      });

      // केवल valid records रखें। Invalid records import/preview से हटा दिए जाएंगे।
      const validRows = previewRows.filter((row) => row.valid);

      setExcelRows(validRows);
      setExcelPreview(validRows.slice(0, 100));
      setExcelTotalRows(validRows.length);
      setExcelInvalidRows(0);
      setExcelImportProgress(0);
      setExcelImportSuccess(0);
      setExcelImportErrorRows(0);
    } catch (error) {
      console.error(error);
      setExcelError(
        error instanceof Error
          ? error.message
          : "Excel पढ़ने में समस्या हुई।"
      );
      setExcelPreview([]);
      setExcelTotalRows(0);
      setExcelInvalidRows(0);
    } finally {
      setExcelLoading(false);
    }
  };


  const importExcelToDatabase = async () => {
    if (!excelRows.length) {
      setExcelError("Import करने के लिए कोई valid record नहीं है।");
      return;
    }

    const confirmed = window.confirm(
      `क्या आप ${excelRows.length} valid records को Supabase database में import करना चाहते हैं?\n\n` +
        "यह records Calendar में भी दिखाई देंगे।"
    );

    if (!confirmed) return;

    setExcelImporting(true);
    setExcelError("");
    setExcelImportProgress(0);
    setExcelImportSuccess(0);
    setExcelImportErrorRows(0);

    try {
      const records = excelRows.map((row) => ({
        program_date: row.program_date,
        program_time: row.program_time,
        title: row.title.trim() || "कार्यक्रम",
        sender_name: row.sender_name.trim() || null,
        address1: row.address1.trim() || null,
        address2: row.address2.trim() || null,
        address3: null,
        district: row.district.trim() || null,
        state: row.state.trim() || null,
        mobile_number: row.mobile_number.replace(/\s/g, "") || null,
        location: row.location.trim() || "स्थान उपलब्ध नहीं",
        category: row.category,
        photo_url: null,
        description: row.description.trim() || null,
        groom_name:
          row.category === "वैवाहिक"
            ? row.groom_name.trim() || null
            : null,
        bride_name:
          row.category === "वैवाहिक"
            ? row.bride_name.trim() || null
            : null,
        deceased_name:
          row.category === "शोक"
            ? row.deceased_name.trim() || null
            : null,
        updated_at: new Date().toISOString(),
      }));

      // Supabase में एक साथ बहुत बड़ा payload भेजने से बचने के लिए
      // 200 records के batches में insert करें।
      const batchSize = 200;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        const { error } = await supabase
          .from("daily_programs")
          .insert(batch);

        if (error) {
          console.error("Excel batch import error:", error);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
        }

        const processed = Math.min(i + batch.length, records.length);
        setExcelImportSuccess(successCount);
        setExcelImportErrorRows(errorCount);
        setExcelImportProgress(
          Math.round((processed / records.length) * 100)
        );
      }

      // Database से fresh data लाकर Calendar और lists को तुरंत update करें।
      await loadPrograms();

      if (successCount > 0) {
        setActiveView("dashboard");
      }

      if (successCount > 0) {
        alert(
          `Excel Import पूरा हुआ।\n\nसफल: ${successCount}\nअसफल: ${errorCount}\n\nCalendar आपकी selected date पर ही रहेगा।`
        );
      } else {
        alert(
          "कोई record import नहीं हुआ। कृपया Console और Supabase error देखें।"
        );
      }
    } catch (error) {
      console.error(error);
      setExcelError(
        error instanceof Error
          ? error.message
          : "Excel database में import नहीं हो सका।"
      );
    } finally {
      setExcelImporting(false);
    }
  };

  const saveProgram = async () => {
    if (!form.date || !form.time || !form.title || !form.location) {
      alert("कृपया तारीख, समय, कार्यक्रम और स्थान भरें।");
      return;
    }

    if (
      form.mobile_number &&
      !/^[0-9]{10}$/.test(form.mobile_number.replace(/\s/g, ""))
    ) {
      alert("कृपया 10 अंकों का सही मोबाइल नंबर दर्ज करें।");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let photoUrl = existingPhotoUrl || null;

      // नया photo चुना गया है तो Supabase Storage में upload करें।
      if (selectedPhoto) {
        const extension =
          selectedPhoto.name.split(".").pop()?.toLowerCase() || "jpg";

        const safeTitle =
          form.title
            .trim()
            .replace(/[^a-zA-Z0-9-_]/g, "-")
            .slice(0, 40) || "program";

        const fileName = `${Date.now()}-${safeTitle}.${extension}`;
        const filePath = `programs/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("program-photos")
          .upload(filePath, selectedPhoto, {
            cacheControl: "3600",
            upsert: false,
            contentType: selectedPhoto.type || "image/jpeg",
          });

        if (uploadError) {
          console.error(uploadError);
          throw new Error(
            "Photo upload नहीं हुआ। Supabase Storage policy check करें।"
          );
        }

        const { data: publicUrlData } = supabase.storage
          .from("program-photos")
          .getPublicUrl(filePath);

        photoUrl = publicUrlData.publicUrl;
      }

      const programData = {
        program_date: form.date,
        program_time: form.time,
        title: form.title.trim(),
        sender_name: form.sender_name.trim() || null,
        address1: form.address1.trim() || null,
        address2: form.address2.trim() || null,
        address3: form.address3.trim() || null,
        district: form.district.trim() || null,
        state: form.state.trim() || null,
        mobile_number: form.mobile_number.replace(/\s/g, "") || null,
        location: form.location.trim(),
        category: form.category,
        photo_url: photoUrl,
        description: form.description.trim() || null,
        groom_name:
          form.category === "वैवाहिक" ? form.groom_name.trim() || null : null,
        bride_name:
          form.category === "वैवाहिक" ? form.bride_name.trim() || null : null,
        deceased_name:
          form.category === "शोक" ? form.deceased_name.trim() || null : null,
        updated_at: new Date().toISOString(),
      };

      if (editingId !== null) {
        const { error } = await supabase
          .from("daily_programs")
          .update(programData)
          .eq("id", editingId);

        if (error) {
          console.error(error);
          throw new Error("कार्यक्रम update नहीं हो सका।");
        }
      } else {
        const { error } = await supabase
          .from("daily_programs")
          .insert(programData);

        if (error) {
          console.error(error);
          throw new Error("कार्यक्रम save नहीं हो सका।");
        }
      }

      setSelectedDate(form.date);
      setShowForm(false);
      setEditingId(null);
      setSelectedPhoto(null);
      setPhotoPreview("");
      setExistingPhotoUrl("");

      setForm({
        ...emptyForm,
        date: form.date,
      });

      await loadPrograms();
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "कार्यक्रम save नहीं हो सका।"
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // DELETE
  // =========================================================

  const deleteProgram = async (id: number) => {
    const confirmDelete = window.confirm(
      "क्या आप यह कार्यक्रम हटाना चाहते हैं?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("daily_programs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setError("कार्यक्रम delete नहीं हो सका।");
      return;
    }

    await loadPrograms();
  };

  // =========================================================
  // DATE-WISE PDF REPORT
  // =========================================================

  const downloadDatePdf = async () => {
    if (!selectedDate) {
      alert("कृपया तारीख चुनें।");
      return;
    }

    if (selectedDatePrograms.length === 0) {
      alert("इस तारीख के लिए कोई कार्यक्रम उपलब्ध नहीं है।");
      return;
    }

    try {
      setPdfLoading(true);

      // Landscape A4 रखा गया है क्योंकि report में सभी fields दिखानी हैं।
      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "landscape",
      });

      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 8;
      const contentWidth = pageWidth - margin * 2;

      // PDF में Photo Upload और अतिरिक्त विवरण जानबूझकर शामिल नहीं किए गए हैं।
      const columns = [
        { key: "sr", label: "क्र.", width: 9 },
        { key: "time", label: "समय", width: 18 },
        { key: "title", label: "कार्यक्रम", width: 34 },
        { key: "sender", label: "प्रेषक का नाम", width: 27 },
        { key: "mobile", label: "Mobile", width: 23 },
        { key: "location", label: "कार्यक्रम का स्थान", width: 30 },
        { key: "category", label: "श्रेणी", width: 20 },
      ];

      // चुने हुए columns का total width exact content width के बराबर करें।
      const widthScale =
        contentWidth /
        columns.reduce((sum, column) => sum + column.width, 0);

      columns.forEach((column) => {
        column.width = column.width * widthScale;
      });

      const getValue = (program: Program, key: string) => {
        switch (key) {
          case "sr":
            return "";
          case "time":
            return formatTime(program.program_time);
          case "title":
            return program.title || "";
          case "sender":
            return program.sender_name || "";
          case "mobile":
            return program.mobile_number || "";
          case "location":
            return program.location || "";
          case "category":
            return program.category || "";
          default:
            return "";
        }
      };

      // Hindi/Devanagari font के लिए browser canvas का image rendering
      // इस्तेमाल किया गया है, ताकि PDF में Hindi fields सही दिखाई दें।
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Canvas उपलब्ध नहीं है।");
      }

      const canvasWidth = 1600;
      const canvasHeight = 1131;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const drawWrappedCanvas = (
        value: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        font: string
      ) => {
        ctx.font = font;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        const textValue = String(value || "");
        if (!textValue) return;

        // Hindi/English mixed text को character chunks में wrap करें।
        const chars = Array.from(textValue);
        const lines: string[] = [];
        let current = "";

        for (const char of chars) {
          const test = current + char;

          if (
            ctx.measureText(test).width <= maxWidth ||
            current.length === 0
          ) {
            current = test;
          } else {
            lines.push(current);
            current = char;
          }
        }

        if (current) lines.push(current);

        const maxLines = 2;
        const visibleLines = lines.slice(0, maxLines);

        visibleLines.forEach((line, index) => {
          let displayLine = line;

          if (
            index === maxLines - 1 &&
            lines.length > maxLines &&
            displayLine.length > 2
          ) {
            displayLine =
              displayLine.slice(0, Math.max(1, displayLine.length - 1)) +
              "…";
          }

          ctx.fillText(
            displayLine,
            x,
            y + (index - (visibleLines.length - 1) / 2) * lineHeight
          );
        });
      };

      const recordsPerPage = 8;
      const totalPages = Math.ceil(
        selectedDatePrograms.length / recordsPerPage
      );

      const drawPage = (
        pagePrograms: Program[],
        pageNumber: number
      ) => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        ctx.textBaseline = "alphabetic";

        // Header
        ctx.textAlign = "center";
        ctx.fillStyle = "#1e40af";
        ctx.font =
          'bold 42px "Nirmala UI", "Mangal", Arial, sans-serif';
        ctx.fillText(
          "दैनिक कार्यक्रम प्रबंधन",
          canvasWidth / 2,
          55
        );

        ctx.fillStyle = "#475569";
        ctx.font =
          '20px "Nirmala UI", "Mangal", Arial, sans-serif';
        ctx.fillText(
          `दैनिक कार्यक्रम रिपोर्ट — ${formatDate(selectedDate)}`,
          canvasWidth / 2,
          88
        );

        ctx.fillStyle = "#111827";
        ctx.font =
          'bold 20px "Nirmala UI", "Mangal", Arial, sans-serif';
        ctx.fillText(
          `कुल कार्यक्रम: ${selectedDatePrograms.length}`,
          canvasWidth / 2,
          120
        );

        // Table
        const tableX = 28;
        const tableY = 150;
        const headerH = 52;
        const rowH = 95;
        const scaleX = canvasWidth / pageWidth;
        const canvasColWidths = columns.map(
          (column) => column.width * scaleX
        );

        let x = tableX;

        ctx.fillStyle = "#dbeafe";
        ctx.fillRect(
          tableX,
          tableY,
          canvasColWidths.reduce((a, b) => a + b, 0),
          headerH
        );

        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          tableX,
          tableY,
          canvasColWidths.reduce((a, b) => a + b, 0),
          headerH
        );

        // Header cells
        ctx.fillStyle = "#111827";
        ctx.font =
          'bold 18px "Nirmala UI", "Mangal", Arial, sans-serif';

        columns.forEach((column, index) => {
          const w = canvasColWidths[index];

          ctx.strokeRect(x, tableY, w, headerH);

          drawWrappedCanvas(
            column.label,
            x + 6,
            tableY + headerH / 2,
            w - 12,
            20,
            'bold 17px "Nirmala UI", "Mangal", Arial, sans-serif'
          );

          x += w;
        });

        // Rows
        pagePrograms.forEach((program, rowIndex) => {
          const rowY = tableY + headerH + rowIndex * rowH;

          ctx.fillStyle =
            rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc";

          ctx.fillRect(
            tableX,
            rowY,
            canvasColWidths.reduce((a, b) => a + b, 0),
            rowH
          );

          x = tableX;

          columns.forEach((column, colIndex) => {
            const w = canvasColWidths[colIndex];

            ctx.strokeStyle = "#94a3b8";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, rowY, w, rowH);

            let value = getValue(program, column.key);

            if (column.key === "sr") {
              value = String(
                (pageNumber - 1) * recordsPerPage + rowIndex + 1
              );
            }

            const font =
              column.key === "title"
                ? 'bold 17px "Nirmala UI", "Mangal", Arial, sans-serif'
                : '16px "Nirmala UI", "Mangal", Arial, sans-serif';

            ctx.fillStyle = "#111827";

            drawWrappedCanvas(
              value,
              x + 6,
              rowY + rowH / 2,
              w - 12,
              21,
              font
            );

            x += w;
          });
        });

        // Footer
        ctx.textAlign = "center";
        ctx.fillStyle = "#64748b";
        ctx.font =
          '16px "Nirmala UI", "Mangal", Arial, sans-serif';

        ctx.fillText(
          `दैनिक कार्यक्रम प्रबंधन प्रणाली  |  पृष्ठ ${pageNumber} / ${totalPages}`,
          canvasWidth / 2,
          canvasHeight - 25
        );
      };

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        const pagePrograms = selectedDatePrograms.slice(
          page * recordsPerPage,
          (page + 1) * recordsPerPage
        );

        drawPage(pagePrograms, page + 1);

        const imageData = canvas.toDataURL("image/jpeg", 0.96);

        pdf.addImage(
          imageData,
          "JPEG",
          0,
          0,
          297,
          210,
          undefined,
          "FAST"
        );
      }

      const fileDate = selectedDate.split("-").reverse().join("-");

      pdf.save(
        `Daily-Program-Full-Report-${fileDate}.pdf`
      );
    } catch (error) {
      console.error(error);
      alert(
        "PDF download नहीं हो सकी। कृपया Console में error देखें।"
      );
    } finally {
      setPdfLoading(false);
    }
  };

  // =========================================================
  // VAIVAHIK / SHOK MESSAGE PDF
  // =========================================================
  // Hindi text को browser canvas पर render करके A4 PDF बनाया जाता है,
  // इसलिए Devanagari text सामान्य browser font में दिखाई देगा।

  const downloadMessagePdf = async (
    program: Program,
    type: "marriage" | "condolence"
  ) => {
    try {
      if (type === "marriage" && program.category !== "वैवाहिक") {
        alert("यह PDF केवल वैवाहिक कार्यक्रम के लिए है।");
        return;
      }

      if (type === "condolence" && program.category !== "शोक") {
        alert("यह PDF केवल शोक कार्यक्रम के लिए है।");
        return;
      }

      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("Canvas उपलब्ध नहीं है।");

      const canvasWidth = 1240;
      const canvasHeight = 1754;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const isMarriage = type === "marriage";
      const fontFamily = '"Nirmala UI", "Mangal", Arial, sans-serif';

      // =====================================================
      // PREMIUM CARD BACKGROUND
      // =====================================================
      const bgGradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
      if (isMarriage) {
        bgGradient.addColorStop(0, "#fffaf0");
        bgGradient.addColorStop(0.5, "#fffdf7");
        bgGradient.addColorStop(1, "#fff1d0");
      } else {
        bgGradient.addColorStop(0, "#eef2f7");
        bgGradient.addColorStop(0.5, "#ffffff");
        bgGradient.addColorStop(1, "#dce3eb");
      }
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 3D outer shadow
      ctx.fillStyle = "rgba(15, 23, 42, 0.20)";
      ctx.fillRect(55, 58, canvasWidth - 92, canvasHeight - 92);

      // Raised card
      const cardGradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
      cardGradient.addColorStop(0, "#ffffff");
      cardGradient.addColorStop(0.55, isMarriage ? "#fffdf8" : "#ffffff");
      cardGradient.addColorStop(1, isMarriage ? "#fff3d4" : "#e8eef5");
      ctx.fillStyle = cardGradient;
      ctx.fillRect(36, 36, canvasWidth - 96, canvasHeight - 96);

      // Layered borders
      ctx.strokeStyle = isMarriage ? "#7c2d12" : "#334155";
      ctx.lineWidth = 10;
      ctx.strokeRect(36, 36, canvasWidth - 96, canvasHeight - 96);

      ctx.strokeStyle = isMarriage ? "#f59e0b" : "#64748b";
      ctx.lineWidth = 5;
      ctx.strokeRect(58, 58, canvasWidth - 140, canvasHeight - 140);

      ctx.strokeStyle = isMarriage ? "#fde68a" : "#cbd5e1";
      ctx.lineWidth = 2;
      ctx.strokeRect(72, 72, canvasWidth - 168, canvasHeight - 168);

      // Corner ornaments
      ctx.fillStyle = isMarriage ? "#b45309" : "#475569";
      ctx.font = `bold 40px ${fontFamily}`;
      ctx.textAlign = "left";
      ctx.fillText(isMarriage ? "◆" : "◇", 95, 125);
      ctx.textAlign = "right";
      ctx.fillText(isMarriage ? "◆" : "◇", canvasWidth - 120, 125);
      ctx.textAlign = "left";
      ctx.fillText(isMarriage ? "◆" : "◇", 95, canvasHeight - 112);
      ctx.textAlign = "right";
      ctx.fillText(isMarriage ? "◆" : "◇", canvasWidth - 120, canvasHeight - 112);

      // =====================================================
      // TEXT HELPERS
      // =====================================================
      const drawWrapped = (
        value: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        font: string,
        align: CanvasTextAlign = "left",
        maxLines = 10
      ) => {
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = "middle";

        const chars = Array.from(String(value || ""));
        const lines: string[] = [];
        let current = "";

        for (const char of chars) {
          const test = current + char;
          if (ctx.measureText(test).width <= maxWidth || current.length === 0) {
            current = test;
          } else {
            lines.push(current);
            current = char;
          }
        }
        if (current) lines.push(current);

        const visibleLines = lines.slice(0, maxLines);
        visibleLines.forEach((line, index) => {
          let displayLine = line;
          if (index === maxLines - 1 && lines.length > maxLines && displayLine.length > 2) {
            displayLine = displayLine.slice(0, -1) + "…";
          }
          ctx.fillText(displayLine, x, y + index * lineHeight);
        });
        return visibleLines.length;
      };

      // =====================================================
      // TOP DECORATION
      // =====================================================
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = isMarriage ? "#991b1b" : "#334155";
      ctx.font = `bold 30px ${fontFamily}`;
      ctx.fillText(isMarriage ? "|| शुभ विवाह ||" : "|| विनम्र श्रद्धांजलि ||", canvasWidth / 2, 135);

      // =====================================================
      // MAIN 3D TITLE
      // =====================================================
      const titleX = 125;
      const titleY = 175;
      const titleW = canvasWidth - 250;
      const titleH = 155;

      ctx.fillStyle = isMarriage ? "#7c2d12" : "#334155";
      ctx.fillRect(titleX + 12, titleY + 15, titleW, titleH);

      const titleGradient = ctx.createLinearGradient(titleX, titleY, titleX, titleY + titleH);
      if (isMarriage) {
        titleGradient.addColorStop(0, "#fbbf24");
        titleGradient.addColorStop(0.5, "#f59e0b");
        titleGradient.addColorStop(1, "#b45309");
      } else {
        titleGradient.addColorStop(0, "#94a3b8");
        titleGradient.addColorStop(0.5, "#64748b");
        titleGradient.addColorStop(1, "#334155");
      }
      ctx.fillStyle = titleGradient;
      ctx.fillRect(titleX, titleY, titleW, titleH);

      ctx.strokeStyle = isMarriage ? "#fde68a" : "#e2e8f0";
      ctx.lineWidth = 4;
      ctx.strokeRect(titleX + 6, titleY + 6, titleW - 12, titleH - 12);

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold 62px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.fillText(isMarriage ? "हार्दिक शुभकामनाएँ" : "शोक संदेश", canvasWidth / 2, titleY + 98);

      // =====================================================
      // MARRIAGE: NO SEPARATE NAME LINE
      // Names will appear only inside the main blessing text below.
      // =====================================================
      if (isMarriage) {
        // कोई अलग वर/वधु नाम लाइन नहीं। नाम केवल मुख्य संदेश में आएंगे।
      } else {
        // कोई अलग "स्वर्गीय [नाम]" लाइन नहीं। मृतक का नाम केवल मुख्य संदेश में आएगा।
      }

      // =====================================================
      // MAIN MESSAGE
      // =====================================================
      const messageY = 430;
      const messageX = 125;
      const messageW = canvasWidth - 250;
      const messageH = 650;

      ctx.fillStyle = isMarriage ? "rgba(180,83,9,0.16)" : "rgba(51,65,85,0.16)";
      ctx.fillRect(messageX + 12, messageY + 14, messageW, messageH);

      const messageGradient = ctx.createLinearGradient(messageX, messageY, messageX, messageY + messageH);
      if (isMarriage) {
        messageGradient.addColorStop(0, "#fffdf5");
        messageGradient.addColorStop(1, "#fef3c7");
      } else {
        messageGradient.addColorStop(0, "#f8fafc");
        messageGradient.addColorStop(1, "#e2e8f0");
      }
      ctx.fillStyle = messageGradient;
      ctx.fillRect(messageX, messageY, messageW, messageH);

      ctx.strokeStyle = isMarriage ? "#d97706" : "#64748b";
      ctx.lineWidth = 4;
      ctx.strokeRect(messageX, messageY, messageW, messageH);

      ctx.fillStyle = isMarriage ? "#78350f" : "#334155";
      ctx.font = `bold 29px ${fontFamily}`;
      ctx.textAlign = "center";

      let message: string;
      if (isMarriage) {
        const groom = (program.groom_name || "वर का नाम").trim();
        const bride = (program.bride_name || "वधु का नाम").trim();
        message = `ईश्वर से प्रार्थना है कि चि. ${groom} एवं सौ.का. ${bride} का वैवाहिक जीवन सदैव सुख, समृद्धि, प्रेम एवं खुशियों से पूर्ण रहे। आप दोनों के नए जीवन की मंगलमय शुरुआत पर हार्दिक बधाई एवं अनंत शुभकामनाएँ।`;
      } else {
        const deceased = (program.deceased_name || "दिवंगत आत्मा").trim();
        message = `स्वर्गीय ${deceased} के निधन का समाचार अत्यंत दुःखद एवं पीड़ादायक है। ईश्वर दिवंगत आत्मा को अपने श्रीचरणों में स्थान प्रदान करें तथा शोकाकुल परिजनों को इस अपार दुःख को सहन करने की शक्ति प्रदान करें।`;
      }

      drawWrapped(
        message,
        canvasWidth / 2,
        messageY + 90,
        messageW - 90,
        48,
        `27px ${fontFamily}`,
        "center",
        isMarriage ? 8 : 9
      );

      if (isMarriage) {
        ctx.fillStyle = "#b45309";
        ctx.font = `bold 38px ${fontFamily}`;
        ctx.fillText("सात फेरे • सात जन्मों का साथ", canvasWidth / 2, messageY + 500);

        ctx.font = `25px ${fontFamily}`;
        ctx.fillText("सदा सुखी रहें • सदा प्रसन्न रहें", canvasWidth / 2, messageY + 555);
      } else {
        ctx.fillStyle = "#334155";
        ctx.font = `bold 38px ${fontFamily}`;
        ctx.fillText("ॐ शांति", canvasWidth / 2, messageY + 555);
      }

      // =====================================================
      // BOTTOM DECORATION / SIGNATURE
      // Sender name/address is intentionally NOT shown.
      // Only Mayor signature is shown at bottom-right.
      // =====================================================
      const footerTop = 1295;

      // Decorative footer lines removed so there is no horizontal line behind the address.

      ctx.fillStyle = isMarriage ? "#991b1b" : "#475569";
      ctx.font = `bold 28px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.fillText(
        isMarriage ? "नवदंपती के उज्ज्वल भविष्य की मंगलमय कामना" : "शोक संतप्त परिवार के प्रति विनम्र संवेदना",
        canvasWidth / 2,
        footerTop + 72
      );

      // Right-bottom raised signature plaque
      const signW = 430;
      const signH = 145;
      const signX = canvasWidth - signW - 105;
      const signY = 1460;

      ctx.fillStyle = isMarriage ? "rgba(124,45,18,0.22)" : "rgba(51,65,85,0.22)";
      ctx.fillRect(signX + 12, signY + 14, signW, signH);

      const signGradient = ctx.createLinearGradient(signX, signY, signX, signY + signH);
      if (isMarriage) {
        signGradient.addColorStop(0, "#991b1b");
        signGradient.addColorStop(1, "#450a0a");
      } else {
        signGradient.addColorStop(0, "#475569");
        signGradient.addColorStop(1, "#1e293b");
      }
      ctx.fillStyle = signGradient;
      ctx.fillRect(signX, signY, signW, signH);

      ctx.strokeStyle = isMarriage ? "#fbbf24" : "#cbd5e1";
      ctx.lineWidth = 4;
      ctx.strokeRect(signX, signY, signW, signH);

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold 34px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.fillText("मुकेश टटवाल", signX + signW / 2, signY + 57);
      ctx.font = `bold 28px ${fontFamily}`;
      ctx.fillText("महापौर", signX + signW / 2, signY + 103);

      // Bottom address/contact line
      // Replace the old city line with the requested office address and contact details.
      ctx.fillStyle = isMarriage ? "#92400e" : "#475569";
      ctx.font = `bold 18px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.fillText(
        "पता - 1, महापौर विश्राम गृह, ग्राण्ड होटल परिसर, फ्रीगंज, उज्जैन (म.प्र.) 465010, दुरभाष - 0734-2551541 मोबाईल - 9425093592",
        canvasWidth / 2,
        1660
      );

      // Convert canvas to A4 PDF
      const imageData = canvas.toDataURL("image/jpeg", 0.97);
      pdf.addImage(imageData, "JPEG", 0, 0, 210, 297, undefined, "FAST");

      const safeName = (
        type === "marriage"
          ? `${program.groom_name || "वर"}-${program.bride_name || "वधु"}`
          : program.deceased_name || "शोक"
      )
        .replace(/[\\/:*?"<>|]/g, "-")
        .slice(0, 80);

      const datePart = program.program_date
        ? program.program_date.split("-").reverse().join("-")
        : "date";

      pdf.save(
        `${type === "marriage" ? "Vaivahik-Shubhkamna" : "Shok-Sandesh"}-${safeName}-${datePart}.pdf`
      );
    } catch (error) {
      console.error(error);
      alert("संदेश PDF generate नहीं हो सकी। कृपया Console में error देखें।");
    }
  };

  // =========================================================
  // PROGRAM CARD
  // =========================================================

  const ProgramCard = ({ program }: { program: Program }) => {
    return (
      <div className="p-4 md:p-5 border-b last:border-b-0 hover:bg-slate-50 transition">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">

          <div className="w-10 h-10 md:w-11 md:h-11 shrink-0 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            {programs.findIndex((p) => p.id === program.id) + 1}
          </div>

          <div className="lg:w-36 shrink-0">
            <p className="text-xs text-slate-500">
              समय
            </p>

            <p className="font-bold text-blue-700 mt-1">
              ⏰ {formatTime(program.program_time)}
            </p>
          </div>

          <div className="flex-1 min-w-0">

            <div className="flex flex-wrap items-center gap-2">

              <h3 className="font-bold text-base md:text-lg text-slate-800 break-words">
                {program.title}
              </h3>

              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full whitespace-nowrap">
                {program.category}
              </span>

            </div>

            <p className="text-slate-500 mt-1 break-words">
              📍 {program.location}
            </p>

            {program.sender_name && (
              <p className="text-sm text-slate-500 mt-1 break-words">
                👤 {program.sender_name}
              </p>
            )}

            {program.mobile_number && (
              <p className="text-sm text-slate-500 mt-1">
                📱 {program.mobile_number}
              </p>
            )}

          </div>

          {program.photo_url && (
            <a
              href={program.photo_url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0"
              title="Photo देखें"
            >
              <img
                src={program.photo_url}
                alt="कार्यक्रम फोटो"
                className="w-16 h-16 object-cover rounded-xl border border-slate-200"
              />
            </a>
          )}

          <div className="flex flex-wrap gap-2 shrink-0">

            {program.category === "वैवाहिक" && (
              <button
                onClick={() => downloadMessagePdf(program, "marriage")}
                className="px-3 py-2 rounded-lg border border-amber-300 hover:bg-amber-50 text-amber-700 font-semibold text-sm"
                title="वैवाहिक शुभकामना PDF"
              >
                💐 शुभकामना PDF
              </button>
            )}

            {program.category === "शोक" && (
              <button
                onClick={() => downloadMessagePdf(program, "condolence")}
                className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm"
                title="शोक संदेश PDF"
              >
                🕊️ शोक संदेश PDF
              </button>
            )}

            <button
              onClick={() => openEditForm(program)}
              className="px-3 py-2 rounded-lg border border-blue-300 hover:bg-blue-50 text-blue-700"
            >
              ✏️
            </button>

            <button
              onClick={() => deleteProgram(program.id)}
              className="px-3 py-2 rounded-lg border border-red-300 hover:bg-red-50 text-red-600"
            >
              🗑️
            </button>

          </div>

        </div>
      </div>
    );
  };

  // =========================================================
  // CALENDAR VIEW - STEP 7.2
  // =========================================================

  const CalendarView = () => {

    // STEP 7.9:
    // Excel Import के बाद parent component से Calendar का month control होगा।
    const calendarYear = calendarMonth.getFullYear();
    const calendarMonthNumber = calendarMonth.getMonth();

    const monthName = new Intl.DateTimeFormat("hi-IN", {
      month: "long",
    }).format(calendarMonth);

    const firstDay = new Date(
      calendarYear,
      calendarMonthNumber,
      1
    ).getDay();

    const daysInMonth = new Date(
      calendarYear,
      calendarMonthNumber + 1,
      0
    ).getDate();

    const calendarDays = Array.from(
      {
        length: firstDay + daysInMonth,
      },
      (_, index) => {
        if (index < firstDay) {
          return null;
        }

        return index - firstDay + 1;
      }
    );

    const programCountByDate = useMemo(() => {

      const counts: Record<string, number> = {};

      programs.forEach((program) => {
        counts[program.program_date] =
          (counts[program.program_date] || 0) + 1;
      });

      return counts;

    }, [programs]);

    const makeDateString = (day: number) => {
      return `${calendarYear}-${String(
        calendarMonthNumber + 1
      ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    };

    const previousMonth = () => {
      setCalendarMonth(
        new Date(
          calendarYear,
          calendarMonthNumber - 1,
          1
        )
      );
    };

    const nextMonth = () => {
      setCalendarMonth(
        new Date(
          calendarYear,
          calendarMonthNumber + 1,
          1
        )
      );
    };

    const goToToday = () => {

      const current = new Date();

      setCalendarMonth(
        new Date(
          current.getFullYear(),
          current.getMonth(),
          1
        )
      );

      setSelectedDate(today);
    };

    return (
      <section className="bg-white rounded-2xl border shadow-sm overflow-hidden mb-5">

        {/* HEADER */}

        <div className="p-4 md:p-5 border-b bg-slate-50">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

            <div>

              <h2 className="text-xl font-bold text-slate-800">
                📅 कार्यक्रम कैलेंडर
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                कार्यक्रम वाली तारीख पर क्लिक करें
              </p>

            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">

              <button
                type="button"
                onClick={previousMonth}
                className="w-9 h-9 md:w-10 md:h-10 rounded-lg border border-slate-300 bg-white hover:bg-blue-50 text-xl font-bold"
              >
                ‹
              </button>

              <div className="min-w-[120px] md:min-w-[150px] text-center">

                <p className="font-bold text-base md:text-lg text-blue-700">
                  {monthName} {calendarYear}
                </p>

              </div>

              <button
                type="button"
                onClick={nextMonth}
                className="w-9 h-9 md:w-10 md:h-10 rounded-lg border border-slate-300 bg-white hover:bg-blue-50 text-xl font-bold"
              >
                ›
              </button>

              <button
                type="button"
                onClick={goToToday}
                className="px-2.5 md:px-3 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs md:text-sm font-semibold"
              >
                आज
              </button>

            </div>

          </div>

        </div>

        {/* WEEK DAYS */}

        <div className="grid grid-cols-7 bg-blue-50 border-b">

          {[
            "रवि",
            "सोम",
            "मंगल",
            "बुध",
            "गुरु",
            "शुक्र",
            "शनि",
          ].map((day) => (

            <div
              key={day}
              className="text-center py-2.5 md:py-3 text-[10px] md:text-sm font-bold text-slate-700"
            >
              {day}
            </div>

          ))}

        </div>

        {/* CALENDAR GRID */}

        <div className="grid grid-cols-7">

          {calendarDays.map((day, index) => {

            if (day === null) {

              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[65px] sm:min-h-[100px] border-r border-b border-slate-200 bg-slate-50"
                />
              );

            }

            const dateString = makeDateString(day);

            const count =
              programCountByDate[dateString] || 0;

            const isToday =
              dateString === today;

            const isSelected =
              dateString === selectedDate;

            return (
              <button
                key={dateString}
                type="button"
                onClick={() => {
                  setSelectedDate(dateString);
                  setActiveView("dashboard");
                }}
                className={`
                  min-h-[65px] sm:min-h-[100px]
                  p-1 md:p-2
                  border-r border-b border-slate-200
                  text-left
                  transition
                  hover:bg-blue-50
                  ${
                    isSelected
                      ? "bg-blue-50 ring-2 ring-inset ring-blue-500"
                      : "bg-white"
                  }
                `}
              >

                <div className="flex items-start justify-between gap-1">

                  <span
                    className={`
                      w-6 h-6 md:w-8 md:h-8
                      rounded-full
                      flex items-center justify-center
                      text-[10px] md:text-sm
                      font-bold
                      ${
                        isToday
                          ? "bg-blue-700 text-white"
                          : "text-slate-700"
                      }
                    `}
                  >
                    {day}
                  </span>

                  {count > 0 && (

                    <span className="bg-green-100 text-green-700 px-1 md:px-2 py-0.5 rounded-full text-[8px] md:text-xs font-bold">
                      {count}
                    </span>

                  )}

                </div>

                {count > 0 && (

                  <div className="mt-1.5 md:mt-3">

                    <div className="text-[8px] md:text-xs font-semibold text-blue-700">
                      📋 कार्यक्रम
                    </div>

                    <div className="text-[8px] md:text-xs text-slate-500 mt-1">
                      {count} कार्यक्रम
                    </div>

                  </div>

                )}

              </button>
            );
          })}

        </div>

        {/* FOOTER */}

        <div className="flex flex-wrap gap-3 md:gap-4 p-3 md:p-4 bg-slate-50 border-t">

          <div className="flex items-center gap-2 text-xs md:text-sm text-slate-600">

            <span className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-blue-700"></span>

            आज

          </div>

          <div className="flex items-center gap-2 text-xs md:text-sm text-slate-600">

            <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 font-bold text-[10px]">
              2
            </span>

            कार्यक्रमों की संख्या

          </div>

        </div>

      </section>
    );
  };

  // =========================================================
  // UPCOMING TIMELINE - STEP 7.3
  // =========================================================

  const UpcomingTimeline = () => {

    if (upcomingPrograms.length === 0) {

      return (
        <section className="bg-white rounded-2xl border shadow-sm overflow-hidden mb-5">

          <div className="p-5 border-b bg-slate-50">

            <h2 className="text-xl font-bold text-slate-800">
              📌 आगामी कार्यक्रम
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              आज के बाद के निर्धारित कार्यक्रम
            </p>

          </div>

          <div className="p-10 text-center text-slate-500">

            <div className="text-5xl mb-3">
              📅
            </div>

            <p className="font-semibold">
              अभी कोई आगामी कार्यक्रम नहीं है।
            </p>

            <button
              onClick={openAddForm}
              className="mt-4 bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 rounded-xl font-semibold"
            >
              ＋ आगामी कार्यक्रम जोड़ें
            </button>

          </div>

        </section>
      );
    }

    return (
      <section className="bg-white rounded-2xl border shadow-sm overflow-hidden mb-5">

        {/* HEADER */}

        <div className="p-4 md:p-5 border-b bg-slate-50">

          <div className="flex items-center justify-between gap-3">

            <div>

              <h2 className="text-xl font-bold text-slate-800">
                📌 आगामी कार्यक्रम
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                आज के बाद के निर्धारित कार्यक्रम
              </p>

            </div>

            <div className="bg-blue-100 text-blue-700 px-3 py-2 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap">
              {upcomingPrograms.length} कार्यक्रम
            </div>

          </div>

        </div>

        {/* TIMELINE */}

        <div className="p-4 md:p-5">

          {upcomingPrograms.map((program, index) => {

            const currentDate =
              program.program_date;

            const previousDate =
              index > 0
                ? upcomingPrograms[index - 1].program_date
                : null;

            const showDate =
              currentDate !== previousDate;

            return (
              <div key={program.id}>

                {/* DATE */}

                {showDate && (

                  <div
                    className={`
                      flex items-center gap-3
                      ${index === 0 ? "mt-0" : "mt-3"}
                      mb-4
                    `}
                  >

                    <div className="w-3 h-3 rounded-full bg-blue-700 shrink-0"></div>

                    <div className="font-bold text-blue-800 text-sm md:text-base">
                      {formatDate(currentDate)}
                    </div>

                  </div>

                )}

                {/* TIMELINE ITEM */}

                <div className="relative pl-7 md:pl-8 pb-6">

                  {/* LINE */}

                  {index !== upcomingPrograms.length - 1 && (

                    <div className="absolute left-[10px] md:left-[11px] top-4 bottom-0 w-[2px] bg-blue-100"></div>

                  )}

                  {/* DOT */}

                  <div className="absolute left-0 top-1 w-5 h-5 md:w-6 md:h-6 rounded-full bg-blue-600 border-4 border-blue-100"></div>

                  {/* CARD */}

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 md:p-4 hover:border-blue-300 hover:shadow-sm transition">

                    <div className="flex flex-col md:flex-row md:items-center gap-3">

                      {/* TIME */}

                      <div className="md:w-32 shrink-0">

                        <p className="text-xs text-slate-500">
                          समय
                        </p>

                        <p className="font-bold text-blue-700 mt-1 text-sm md:text-base">
                          ⏰ {formatTime(program.program_time)}
                        </p>

                      </div>

                      {/* PROGRAM */}

                      <div className="flex-1 min-w-0">

                        <div className="flex flex-wrap items-center gap-2">

                          <h3 className="font-bold text-slate-800 break-words">
                            {program.title}
                          </h3>

                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full whitespace-nowrap">
                            {program.category}
                          </span>

                        </div>

                        <p className="text-sm text-slate-500 mt-2 break-words">
                          📍 {program.location}
                        </p>

                      </div>

                      {/* ACTIONS */}

                      <div className="flex gap-2 shrink-0">

                        <button
                          onClick={() =>
                            openEditForm(program)
                          }
                          className="px-3 py-2 rounded-lg border border-blue-300 hover:bg-blue-50 text-blue-700"
                        >
                          ✏️
                        </button>

                        <button
                          onClick={() =>
                            deleteProgram(program.id)
                          }
                          className="px-3 py-2 rounded-lg border border-red-300 hover:bg-red-50 text-red-600"
                        >
                          🗑️
                        </button>

                      </div>

                    </div>

                  </div>

                </div>

              </div>
            );
          })}

        </div>

        {/* FOOTER */}

        <div className="px-4 md:px-5 py-4 border-t bg-slate-50">

          <button
            onClick={() => setActiveView("upcoming")}
            className="text-blue-700 font-semibold hover:text-blue-900 text-sm md:text-base"
          >
            सभी आगामी कार्यक्रम देखें →
          </button>

        </div>

      </section>
    );
  };

  // =========================================================
  // RETURN
  // =========================================================

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">

      {/* =====================================================
          HIDDEN DATE-WISE PDF REPORT
      ====================================================== */}

      {/* =====================================================
          TOP HEADER - STEP 7.4
      ====================================================== */}

      <header className="bg-white border-b shadow-sm sticky top-0 z-40">

        <div className="max-w-7xl mx-auto px-4 md:px-5 py-3 md:py-4 flex items-center justify-between">

          {/* LOGO */}

          <div className="flex items-center gap-3 min-w-0">

            <div className="w-10 h-10 md:w-11 md:h-11 shrink-0 rounded-xl bg-blue-700 text-white flex items-center justify-center text-lg md:text-xl font-bold shadow-sm">
              DP
            </div>

            <div className="min-w-0">

              <h1 className="text-lg md:text-2xl font-bold text-slate-800 leading-tight truncate">
                दैनिक कार्यक्रम प्रबंधन
              </h1>

              <p className="text-[10px] md:text-sm text-slate-500 truncate">
                Daily Program Management System
              </p>

            </div>

          </div>

          {/* DESKTOP ADD BUTTON */}

          <div className="hidden md:flex items-center gap-3">

            <button
              onClick={openExcelImport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold shadow-sm transition"
            >
              📥 Excel Import
            </button>

            <button
              onClick={openAddForm}
              className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 rounded-xl font-semibold shadow-sm transition"
            >
              ＋ नया कार्यक्रम
            </button>

          </div>

          {/* MOBILE MENU BUTTON */}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden ml-3 w-10 h-10 shrink-0 rounded-xl bg-blue-700 text-white flex items-center justify-center text-xl shadow-sm hover:bg-blue-800 transition"
            aria-label="मेनू खोलें"
          >
            ☰
          </button>

        </div>

      </header>

      {/* =====================================================
          MOBILE DRAWER - STEP 7.4
      ====================================================== */}

      {mobileMenuOpen && (

        <>

          {/* OVERLAY */}

          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* DRAWER */}

          <div className="fixed top-0 left-0 bottom-0 w-[290px] max-w-[85vw] bg-white z-50 shadow-2xl md:hidden flex flex-col">

            {/* DRAWER HEADER */}

            <div className="bg-blue-700 text-white px-5 py-5 flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 rounded-xl bg-white text-blue-700 flex items-center justify-center font-bold">
                  DP
                </div>

                <div>

                  <h2 className="font-bold">
                    दैनिक कार्यक्रम
                  </h2>

                  <p className="text-xs text-blue-100">
                    मुख्य मेनू
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-2xl flex items-center justify-center"
                aria-label="मेनू बंद करें"
              >
                ×
              </button>

            </div>

            {/* MENU */}

            <div className="p-4 flex-1 overflow-y-auto">

              <p className="text-xs font-bold text-slate-400 uppercase px-3 py-2">
                मुख्य मेनू
              </p>

              <button
                onClick={() => changeView("dashboard")}
                className={`w-full text-left px-4 py-3.5 rounded-xl font-medium transition ${
                  activeView === "dashboard"
                    ? "bg-blue-700 text-white shadow-sm"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                🏠 Dashboard
              </button>

              <button
                onClick={() => changeView("today")}
                className={`w-full text-left px-4 py-3.5 rounded-xl font-medium mt-1 transition ${
                  activeView === "today"
                    ? "bg-blue-700 text-white shadow-sm"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                📅 आज का कार्यक्रम
              </button>

              <button
                onClick={() => changeView("upcoming")}
                className={`w-full text-left px-4 py-3.5 rounded-xl font-medium mt-1 transition ${
                  activeView === "upcoming"
                    ? "bg-blue-700 text-white shadow-sm"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                ➡️ आगामी कार्यक्रम
              </button>

              <button
                onClick={() => changeView("past")}
                className={`w-full text-left px-4 py-3.5 rounded-xl font-medium mt-1 transition ${
                  activeView === "past"
                    ? "bg-blue-700 text-white shadow-sm"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                ⬅️ पुराने कार्यक्रम
              </button>

              {/* DIVIDER */}

              <div className="border-t my-5"></div>

              {/* EXCEL IMPORT */}

              <button
                onClick={openExcelImport}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3.5 rounded-xl font-semibold shadow-sm transition"
              >
                📥 Excel Import
              </button>

              {/* ADD PROGRAM */}

              <button
                onClick={openAddForm}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white px-4 py-3.5 rounded-xl font-semibold shadow-sm transition"
              >
                ＋ नया कार्यक्रम
              </button>

            </div>

            {/* DRAWER FOOTER */}

            <div className="p-4 border-t bg-slate-50">

              <p className="text-xs text-slate-500 text-center">
                Daily Program Management System
              </p>

            </div>

          </div>

        </>

      )}

      {/* =====================================================
          LAYOUT
      ====================================================== */}

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row">

        {/* =====================================================
            DESKTOP SIDEBAR
        ====================================================== */}

        <aside className="hidden md:block md:w-64 shrink-0 p-4">

          <div className="bg-white rounded-2xl border shadow-sm p-3 md:sticky md:top-20">

            <p className="text-xs font-bold text-slate-400 uppercase px-3 py-2">
              मुख्य मेनू
            </p>

            <button
              onClick={() => setActiveView("dashboard")}
              className={`w-full text-left px-4 py-3 rounded-xl font-medium ${
                activeView === "dashboard"
                  ? "bg-blue-700 text-white shadow-sm"
                  : "hover:bg-slate-100"
              }`}
            >
              🏠 Dashboard
            </button>

            <button
              onClick={() => setActiveView("today")}
              className={`w-full text-left px-4 py-3 rounded-xl font-medium mt-1 ${
                activeView === "today"
                  ? "bg-blue-700 text-white shadow-sm"
                  : "hover:bg-slate-100"
              }`}
            >
              📅 आज का कार्यक्रम
            </button>

            <button
              onClick={() => setActiveView("upcoming")}
              className={`w-full text-left px-4 py-3 rounded-xl font-medium mt-1 ${
                activeView === "upcoming"
                  ? "bg-blue-700 text-white shadow-sm"
                  : "hover:bg-slate-100"
              }`}
            >
              ➡️ आगामी कार्यक्रम
            </button>

            <button
              onClick={() => setActiveView("past")}
              className={`w-full text-left px-4 py-3 rounded-xl font-medium mt-1 ${
                activeView === "past"
                  ? "bg-blue-700 text-white shadow-sm"
                  : "hover:bg-slate-100"
              }`}
            >
              ⬅️ पुराने कार्यक्रम
            </button>

          </div>

        </aside>

        {/* =====================================================
            CONTENT
        ====================================================== */}

        <section className="flex-1 min-w-0 p-3 md:p-4 md:pl-0">

          {/* ERROR */}

          {error && (

            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5">
              ⚠️ {error}
            </div>

          )}

          {/* =================================================
              DASHBOARD
          ================================================== */}

          {activeView === "dashboard" && (

            <>

              {/* TODAY HERO */}

              <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl p-5 md:p-6 text-white shadow-lg mb-5">

                <p className="text-blue-100 text-sm">
                  आज का दिन
                </p>

                <h2 className="text-xl md:text-3xl font-bold mt-1">
                  {formatDate(today)}
                </h2>

                <p className="text-blue-100 mt-2 text-sm md:text-base">
                  आज के सभी निर्धारित कार्यक्रम यहाँ देखें।
                </p>

              </div>

              {/* STATS */}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">

                <div className="bg-white rounded-2xl p-4 md:p-5 border shadow-sm">

                  <p className="text-xs md:text-sm text-slate-500">
                    आज के कार्यक्रम
                  </p>

                  <p className="text-2xl md:text-3xl font-bold text-blue-700 mt-2">
                    {todayPrograms.length}
                  </p>

                </div>

                <div className="bg-white rounded-2xl p-4 md:p-5 border shadow-sm">

                  <p className="text-xs md:text-sm text-slate-500">
                    नागरिक भेंट
                  </p>

                  <p className="text-2xl md:text-3xl font-bold text-green-600 mt-2">
                    {citizenCount}
                  </p>

                </div>

                <div className="bg-white rounded-2xl p-4 md:p-5 border shadow-sm">

                  <p className="text-xs md:text-sm text-slate-500">
                    कार्यालयीन कार्य
                  </p>

                  <p className="text-2xl md:text-3xl font-bold text-orange-500 mt-2">
                    {officeCount}
                  </p>

                </div>

                <div className="bg-white rounded-2xl p-4 md:p-5 border shadow-sm">

                  <p className="text-xs md:text-sm text-slate-500">
                    बैठक
                  </p>

                  <p className="text-2xl md:text-3xl font-bold text-purple-600 mt-2">
                    {meetingCount}
                  </p>

                </div>

              </div>

              {/* CALENDAR */}

              <CalendarView />

              {/* UPCOMING TIMELINE */}

              <UpcomingTimeline />

              {/* TODAY / SELECTED DATE */}

              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">

                <div className="px-4 md:px-5 py-4 border-b flex items-center justify-between">

                  <div>

                    <h2 className="text-lg md:text-xl font-bold">
                      {selectedDate === today
                        ? "आज का कार्यक्रम"
                        : "चयनित तारीख का कार्यक्रम"}
                    </h2>

                    <p className="text-sm text-slate-500 mt-1">
                      {selectedDate === today
                        ? "समय के अनुसार सूची"
                        : formatDate(selectedDate)}
                    </p>

                  </div>

                  <button
                    onClick={downloadDatePdf}
                    disabled={pdfLoading}
                    className="border border-blue-300 text-blue-700 px-3 md:px-4 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-60 font-semibold"
                    title="इस तारीख की PDF डाउनलोड करें"
                  >
                    {pdfLoading ? "⏳" : "📄 PDF"}
                  </button>

                </div>

                {loading ? (

                  <div className="p-10 text-center text-slate-500">
                    ⏳ Data load हो रहा है...
                  </div>

                ) : selectedPrograms.length === 0 ? (

                  <div className="p-10 md:p-12 text-center text-slate-500">

                    <div className="text-5xl mb-3">
                      📅
                    </div>

                    <p className="font-semibold">
                      {selectedDate === today
                        ? "आज कोई कार्यक्रम नहीं है।"
                        : "इस तारीख के लिए कोई कार्यक्रम नहीं है।"}
                    </p>

                    <button
                      onClick={openAddForm}
                      className="mt-4 bg-blue-700 text-white px-5 py-3 rounded-xl font-semibold"
                    >
                      ＋ कार्यक्रम जोड़ें
                    </button>

                  </div>

                ) : (

                  selectedPrograms.map((program) => (
                    <ProgramCard
                      key={program.id}
                      program={program}
                    />
                  ))

                )}

              </div>

            </>

          )}

          {/* =================================================
              TODAY
          ================================================== */}

          {activeView === "today" && (

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">

              <div className="p-5 border-b">

                <h2 className="text-xl md:text-2xl font-bold">
                  📅 आज का कार्यक्रम
                </h2>

                <p className="text-slate-500 mt-1">
                  {formatDate(today)}
                </p>

              </div>

              {todayPrograms.length === 0 ? (

                <div className="p-12 text-center text-slate-500">
                  कोई कार्यक्रम नहीं है।
                </div>

              ) : (

                todayPrograms.map((program) => (
                  <ProgramCard
                    key={program.id}
                    program={program}
                  />
                ))

              )}

            </div>

          )}

          {/* =================================================
              UPCOMING
          ================================================== */}

          {activeView === "upcoming" && (

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">

              <div className="p-5 border-b">

                <h2 className="text-xl md:text-2xl font-bold">
                  ➡️ आगामी कार्यक्रम
                </h2>

                <p className="text-slate-500 mt-1">
                  आज के बाद के सभी कार्यक्रम
                </p>

              </div>

              {upcomingPrograms.length === 0 ? (

                <div className="p-12 text-center text-slate-500">
                  कोई आगामी कार्यक्रम नहीं है।
                </div>

              ) : (

                upcomingPrograms.map((program) => (

                  <div
                    key={program.id}
                    className="border-b last:border-b-0"
                  >

                    <div className="px-5 pt-4">

                      <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                        {formatShortDate(program.program_date)}
                      </span>

                    </div>

                    <ProgramCard program={program} />

                  </div>

                ))

              )}

            </div>

          )}

          {/* =================================================
              PAST
          ================================================== */}

          {activeView === "past" && (

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">

              <div className="p-5 border-b">

                <h2 className="text-xl md:text-2xl font-bold">
                  ⬅️ पुराने कार्यक्रम
                </h2>

                <p className="text-slate-500 mt-1">
                  पहले हो चुके कार्यक्रम
                </p>

              </div>

              {pastPrograms.length === 0 ? (

                <div className="p-12 text-center text-slate-500">
                  कोई पुराना कार्यक्रम नहीं है।
                </div>

              ) : (

                pastPrograms.map((program) => (

                  <div
                    key={program.id}
                    className="border-b last:border-b-0"
                  >

                    <div className="px-5 pt-4">

                      <span className="inline-block bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-semibold">
                        {formatShortDate(program.program_date)}
                      </span>

                    </div>

                    <ProgramCard program={program} />

                  </div>

                ))

              )}

            </div>

          )}

          {/* =================================================
              DATE SEARCH
          ================================================== */}

          <div className="bg-white rounded-2xl border shadow-sm p-4 md:p-5 mt-5">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>

                <label className="block text-sm font-semibold mb-2">
                  📅 किसी तारीख का कार्यक्रम
                </label>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setActiveView("dashboard");
                  }}
                  className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />

              </div>

              <div>

                <label className="block text-sm font-semibold mb-2">
                  🔍 कार्यक्रम खोजें
                </label>

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="कार्यक्रम, स्थान या श्रेणी..."
                  className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />

              </div>

            </div>

          </div>

        </section>

      </div>

      {/* =====================================================
          STEP 7.8 - EXCEL IMPORT PREVIEW MODAL
      ====================================================== */}

      {excelImportOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">

            <div className="px-5 md:px-6 py-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg md:text-xl font-bold">
                  📥 Excel Import
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  पहले Excel का Preview देखें। Import करने के बाद data database में save होगा और Calendar आपकी selected date पर ही रहेगा।
                </p>
              </div>

              <button
                onClick={closeExcelImport}
                className="text-2xl text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="p-5 md:p-6 overflow-y-auto space-y-5">

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50">
                <div className="text-4xl mb-3">📊</div>

                <p className="font-semibold text-slate-800">
                  Excel file चुनें
                </p>

                <p className="text-sm text-slate-500 mt-1">
                  .xlsx या .xls
                </p>

                <label className="inline-flex mt-4 cursor-pointer bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 rounded-xl font-semibold">
                  Excel चुनें
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      void handleExcelSelect(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>

                {excelFile && (
                  <p className="mt-3 text-sm text-slate-600">
                    चुनी गई file: <strong>{excelFile.name}</strong>
                  </p>
                )}
              </div>

              {excelLoading && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-blue-800">
                  Excel पढ़ा जा रहा है, कृपया प्रतीक्षा करें...
                </div>
              )}

              {excelError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">
                  {excelError}
                </div>
              )}

              {excelTotalRows > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Import के लिए Records</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">
                        {excelTotalRows}
                      </p>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                      <p className="text-xs text-slate-500">Valid Records</p>
                      <p className="text-2xl font-bold text-emerald-700 mt-1">
                        {excelTotalRows - excelInvalidRows}
                      </p>
                    </div>

                    <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                      <p className="text-xs text-slate-500">हटाए गए Invalid</p>
                      <p className="text-2xl font-bold text-red-700 mt-1">
                        {excelInvalidRows}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b">
                      <h3 className="font-bold">
                        पहले {Math.min(excelPreview.length, 100)} records का Preview
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Preview के बाद नीचे दिए गए बटन से records database में import किए जा सकते हैं।
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-[1400px] w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-3 py-3 text-left">Excel Row</th>
                            <th className="px-3 py-3 text-left">दिनांक</th>
                            <th className="px-3 py-3 text-left">समय</th>
                            <th className="px-3 py-3 text-left">कार्यक्रम</th>
                            <th className="px-3 py-3 text-left">श्रेणी</th>
                            <th className="px-3 py-3 text-left">वर/वधु</th>
                            <th className="px-3 py-3 text-left">मृतक</th>
                            <th className="px-3 py-3 text-left">स्थान</th>
                            <th className="px-3 py-3 text-left">प्रेषक</th>
                            <th className="px-3 py-3 text-left">मोबाइल</th>
                            <th className="px-3 py-3 text-left">स्थिति</th>
                          </tr>
                        </thead>

                        <tbody>
                          {excelPreview.map((row) => (
                            <tr
                              key={row.rowNumber}
                              className={`border-t ${
                                row.valid ? "" : "bg-red-50"
                              }`}
                            >
                              <td className="px-3 py-3">{row.rowNumber}</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {row.program_date || "-"}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {row.program_time || "-"}
                              </td>
                              <td className="px-3 py-3 max-w-[280px]">
                                {row.title}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {row.category}
                              </td>
                              <td className="px-3 py-3">
                                {row.groom_name || "-"}
                              </td>
                              <td className="px-3 py-3">
                                {row.deceased_name || "-"}
                              </td>
                              <td className="px-3 py-3">{row.location}</td>
                              <td className="px-3 py-3">{row.sender_name || "-"}</td>
                              <td className="px-3 py-3">{row.mobile_number || "-"}</td>
                              <td className="px-3 py-3">
                                {row.valid ? (
                                  <span className="text-emerald-700 font-semibold">
                                    ✓ Valid
                                  </span>
                                ) : (
                                  <span className="text-red-700 font-semibold">
                                    ✕ {row.error}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 md:px-6 py-4 border-t bg-slate-50 flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={closeExcelImport}
                disabled={excelLoading || excelImporting}
                className="px-5 py-3 rounded-xl border bg-white hover:bg-slate-100 font-semibold disabled:opacity-50"
              >
                बंद करें
              </button>

              <div className="flex-1 sm:flex sm:items-center sm:justify-end gap-3">
                {excelImporting && (
                  <div className="w-full sm:w-72 mb-3 sm:mb-0">
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Database Import चल रहा है...</span>
                      <span>{excelImportProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all"
                        style={{ width: `${excelImportProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      सफल: {excelImportSuccess} | असफल: {excelImportErrorRows}
                    </p>
                  </div>
                )}

                <button
                  onClick={importExcelToDatabase}
                  disabled={
                    excelImporting ||
                    excelLoading ||
                    excelRows.length === 0
                  }
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed"
                >
                  {excelImporting
                    ? "Import हो रहा है..."
                    : `Import to Database (${excelRows.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          ADD / EDIT MODAL
      ====================================================== */}

      {showForm && (

        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">

          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

            <div className="px-5 md:px-6 py-5 border-b flex items-center justify-between">

              <div>

                <h2 className="text-lg md:text-xl font-bold">
                  {editingId !== null
                    ? "कार्यक्रम में बदलाव करें"
                    : "नया कार्यक्रम जोड़ें"}
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  कार्यक्रम की जानकारी दर्ज करें
                </p>

              </div>

              <button
                onClick={() => setShowForm(false)}
                className="text-2xl text-slate-400 hover:text-slate-700"
              >
                ×
              </button>

            </div>

            <div className="p-5 md:p-6 space-y-4">

              {/* DATE + TIME */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-semibold mb-1">
                    📅 तारीख *
                  </label>

                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        date: e.target.value,
                      })
                    }
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">
                    ⏰ समय *
                  </label>

                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        time: e.target.value,
                      })
                    }
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

              </div>

              {/* PROGRAM */}

              <div>
                <label className="block text-sm font-semibold mb-1">
                  📋 कार्यक्रम *
                </label>

                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      title: e.target.value,
                    })
                  }
                  placeholder="कार्यक्रम का नाम"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              {/* SENDER */}

              <div>
                <label className="block text-sm font-semibold mb-1">
                  👤 प्रेषक का नाम
                </label>

                <input
                  type="text"
                  value={form.sender_name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sender_name: e.target.value,
                    })
                  }
                  placeholder="प्रेषक का पूरा नाम"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              {/* ADDRESS 1 */}

              <div>
                <label className="block text-sm font-semibold mb-1">
                  🏠 Address 1
                </label>

                <input
                  type="text"
                  value={form.address1}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address1: e.target.value,
                    })
                  }
                  placeholder="मकान नंबर / मोहल्ला / वार्ड"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              {/* ADDRESS 2 */}

              <div>
                <label className="block text-sm font-semibold mb-1">
                  🏠 Address 2
                </label>

                <input
                  type="text"
                  value={form.address2}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address2: e.target.value,
                    })
                  }
                  placeholder="गली / क्षेत्र"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              {/* ADDRESS 3 */}

              <div>
                <label className="block text-sm font-semibold mb-1">
                  🏠 Address 3
                </label>

                <input
                  type="text"
                  value={form.address3}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address3: e.target.value,
                    })
                  }
                  placeholder="अन्य पता"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              {/* DISTRICT + STATE */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-semibold mb-1">
                    📍 District
                  </label>

                  <input
                    type="text"
                    value={form.district}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        district: e.target.value,
                      })
                    }
                    placeholder="जिला"
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">
                    🗺️ State
                  </label>

                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        state: e.target.value,
                      })
                    }
                    placeholder="राज्य का नाम लिखें"
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>

              </div>

              {/* MOBILE */}

              <div>
                <label className="block text-sm font-semibold mb-1">
                  📱 Mobile Number
                </label>

                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.mobile_number}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      mobile_number: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="10 अंकों का मोबाइल नंबर"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              {/* LOCATION */}

              <div>
                <label className="block text-sm font-semibold mb-1">
                  📍 कार्यक्रम का स्थान *
                </label>

                <input
                  type="text"
                  value={form.location}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      location: e.target.value,
                    })
                  }
                  placeholder="कार्यक्रम का स्थान"
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              {/* CATEGORY */}

              <div>
                <label className="block text-sm font-semibold mb-1">
                  🏷️ श्रेणी
                </label>

                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value,
                    })
                  }
                  className="w-full border rounded-xl px-4 py-3"
                >
                  <option>नागरिक भेंट</option>
                  <option>कार्यालयीन कार्य</option>
                  <option>कार्यक्रम</option>
                  <option>बैठक</option>
                  <option>दौरा</option>
                  <option>निरीक्षण</option>
                  <option>शासकीय</option>
                  <option>पार्टी</option>
                  <option>धार्मिक</option>
                  <option>वैवाहिक</option>
                    <option>शोक</option>
                    <option>अन्य</option>
                </select>

                {form.category === "वैवाहिक" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">
                        वर का नाम
                      </label>
                      <input
                        type="text"
                        value={form.groom_name}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            groom_name: e.target.value,
                          })
                        }
                        placeholder="वर का नाम लिखें"
                        className="w-full border rounded-xl px-4 py-3"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">
                        वधु का नाम
                      </label>
                      <input
                        type="text"
                        value={form.bride_name}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            bride_name: e.target.value,
                          })
                        }
                        placeholder="वधु का नाम लिखें"
                        className="w-full border rounded-xl px-4 py-3"
                      />
                    </div>
                  </div>
                )}

                {form.category === "शोक" && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      मृतक व्यक्ति का नाम
                    </label>
                    <input
                      type="text"
                      value={form.deceased_name}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          deceased_name: e.target.value,
                        })
                      }
                      placeholder="मृतक व्यक्ति का नाम लिखें"
                      className="w-full border rounded-xl px-4 py-3"
                    />
                  </div>
                )}

              </div>

              {/* PHOTO */}

              <div>
                <label className="block text-sm font-semibold mb-1">
                  📷 Photo Upload
                </label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handlePhotoChange(e.target.files?.[0] || null)
                  }
                  className="w-full border rounded-xl px-4 py-3 bg-white"
                />

                <p className="text-xs text-slate-500 mt-1">
                  JPG, PNG आदि • अधिकतम 5 MB
                </p>

                {photoPreview && (
                  <div className="mt-3 flex items-start gap-3">
                    <img
                      src={photoPreview}
                      alt="Photo Preview"
                      className="w-28 h-28 object-cover rounded-xl border"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPhoto(null);
                        setPhotoPreview("");
                        setExistingPhotoUrl("");
                      }}
                      className="px-3 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm"
                    >
                      फोटो हटाएँ
                    </button>
                  </div>
                )}
              </div>

              {/* DESCRIPTION */}

              <div>
                <label className="block text-sm font-semibold mb-1">
                  📝 अतिरिक्त विवरण
                </label>

                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description: e.target.value,
                    })
                  }
                  placeholder="कार्यक्रम से संबंधित अतिरिक्त जानकारी"
                  rows={4}
                  className="w-full border rounded-xl px-4 py-3 resize-none"
                />
              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="px-5 md:px-6 py-4 border-t flex justify-end gap-3">

              <button
                onClick={() => setShowForm(false)}
                className="px-4 md:px-5 py-3 rounded-xl border"
              >
                रद्द करें
              </button>

              <button
                onClick={saveProgram}
                disabled={saving}
                className="px-4 md:px-5 py-3 rounded-xl bg-blue-700 text-white font-semibold disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                  ? "Update"
                  : "Save Program"}
              </button>

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          PRINT
      ====================================================== */}

      <style jsx global>{`
        @media print {
          header,
          aside,
          button,
          input,
          select {
            display: none !important;
          }

          body,
          main {
            background: white !important;
          }

          .shadow-sm,
          .shadow-lg {
            box-shadow: none !important;
          }
        }
      `}</style>

    </main>
  );
}