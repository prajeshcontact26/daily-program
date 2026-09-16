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

      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      });

      // =====================================================
      // SMART DYNAMIC DESIGN
      // Fixed 7-day design नहीं है।
      // उस तारीख के actual programs/categories के आधार पर
      // theme, title, icons, card style और layout बदलता है।
      // =====================================================

      const categoryCounts: Record<string, number> = {};

      selectedDatePrograms.forEach((program) => {
        categoryCounts[program.category] =
          (categoryCounts[program.category] || 0) + 1;
      });

      const sortedCategories = Object.entries(categoryCounts).sort(
        (a, b) => b[1] - a[1]
      );

      const primaryCategory =
        sortedCategories[0]?.[0] || "अन्य";

      const categoryTheme: Record<
        string,
        {
          name: string;
          subtitle: string;
          top: string;
          bottom: string;
          accent: string;
          light: string;
          dark: string;
          icon: string;
        }
      > = {
        "धार्मिक": {
          name: "आस्था एवं धार्मिक कार्यक्रम",
          subtitle: "उज्जैन की धार्मिक एवं आध्यात्मिक गतिविधियाँ",
          top: "#17365d",
          bottom: "#7c2d12",
          accent: "#f59e0b",
          light: "#fff7df",
          dark: "#713f12",
          icon: "ॐ",
        },
        "वैवाहिक": {
          name: "शुभ विवाह एवं मंगल कार्यक्रम",
          subtitle: "मंगलमय अवसरों के लिए हार्दिक शुभकामनाएँ",
          top: "#7f1d1d",
          bottom: "#9a3412",
          accent: "#f59e0b",
          light: "#fff7ed",
          dark: "#7c2d12",
          icon: "♥",
        },
        "शोक": {
          name: "श्रद्धांजलि एवं संवेदना",
          subtitle: "शोक संतप्त परिवार के प्रति विनम्र संवेदना",
          top: "#334155",
          bottom: "#0f172a",
          accent: "#94a3b8",
          light: "#f1f5f9",
          dark: "#334155",
          icon: "ॐ",
        },
        "नागरिक भेंट": {
          name: "जनसंपर्क एवं नागरिक भेंट",
          subtitle: "नागरिकों से संवाद एवं जनसेवा",
          top: "#075985",
          bottom: "#1d4ed8",
          accent: "#22c55e",
          light: "#eff6ff",
          dark: "#1e3a8a",
          icon: "👥",
        },
        "शासकीय": {
          name: "शासकीय कार्यक्रम",
          subtitle: "शासकीय दायित्व एवं सार्वजनिक कार्य",
          top: "#1e3a8a",
          bottom: "#1e40af",
          accent: "#f59e0b",
          light: "#eff6ff",
          dark: "#1e3a8a",
          icon: "🏛",
        },
        "कार्यालयीन कार्य": {
          name: "कार्यालयीन कार्य",
          subtitle: "कार्यालयीन कार्य एवं प्रशासनिक गतिविधियाँ",
          top: "#0f3b5f",
          bottom: "#1e40af",
          accent: "#38bdf8",
          light: "#eff6ff",
          dark: "#0f3b5f",
          icon: "▣",
        },
        "बैठक": {
          name: "बैठक एवं विचार-विमर्श",
          subtitle: "बैठक, समीक्षा एवं महत्वपूर्ण चर्चा",
          top: "#312e81",
          bottom: "#4338ca",
          accent: "#a78bfa",
          light: "#eef2ff",
          dark: "#312e81",
          icon: "◉",
        },
        "दौरा": {
          name: "दौरा एवं भ्रमण",
          subtitle: "क्षेत्रीय दौरा एवं जनहित गतिविधियाँ",
          top: "#065f46",
          bottom: "#047857",
          accent: "#fbbf24",
          light: "#ecfdf5",
          dark: "#065f46",
          icon: "➤",
        },
        "निरीक्षण": {
          name: "निरीक्षण एवं समीक्षा",
          subtitle: "स्थलीय निरीक्षण एवं कार्यों की समीक्षा",
          top: "#713f12",
          bottom: "#a16207",
          accent: "#f97316",
          light: "#fffbeb",
          dark: "#713f12",
          icon: "✓",
        },
        "पार्टी": {
          name: "सामाजिक एवं पार्टी कार्यक्रम",
          subtitle: "सामाजिक सहभागिता एवं सार्वजनिक कार्यक्रम",
          top: "#701a75",
          bottom: "#86198f",
          accent: "#f472b6",
          light: "#fdf4ff",
          dark: "#701a75",
          icon: "★",
        },
        "कार्यक्रम": {
          name: "विशेष कार्यक्रम",
          subtitle: "दैनिक महत्वपूर्ण कार्यक्रम एवं गतिविधियाँ",
          top: "#0c4a6e",
          bottom: "#0369a1",
          accent: "#fbbf24",
          light: "#f0f9ff",
          dark: "#0c4a6e",
          icon: "◆",
        },
        "अन्य": {
          name: "दैनिक कार्यक्रम",
          subtitle: "आज के निर्धारित कार्यक्रम एवं गतिविधियाँ",
          top: "#1e3a8a",
          bottom: "#3730a3",
          accent: "#60a5fa",
          light: "#eff6ff",
          dark: "#1e3a8a",
          icon: "◆",
        },
      };

      // यदि दिन में कई categories हैं तो mixed theme रखें।
      const theme =
        sortedCategories.length > 1
          ? {
              name: "दैनिक कार्यक्रम एवं जनसेवा",
              subtitle: `${sortedCategories
                .slice(0, 3)
                .map(([name]) => name)
                .join(" • ")}${sortedCategories.length > 3 ? " • अन्य" : ""}`,
              top: "#0f3b5f",
              bottom: "#1e40af",
              accent: "#f59e0b",
              light: "#eff6ff",
              dark: "#0f3b5f",
              icon: "✦",
            }
          : categoryTheme[primaryCategory] || categoryTheme["अन्य"];

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Canvas उपलब्ध नहीं है।");
      }

      const canvasWidth = 1240;
      const canvasHeight = 1754;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const fontFamily = '"Nirmala UI", "Mangal", Arial, sans-serif';

      const roundRect = (
        x: number,
        y: number,
        w: number,
        h: number,
        r: number
      ) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };

      const drawWrapped = (
        value: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        font: string,
        align: CanvasTextAlign = "left",
        maxLines = 3
      ) => {
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = "middle";

        const chars = Array.from(String(value || ""));
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

        const visibleLines = lines.slice(0, maxLines);

        visibleLines.forEach((line, index) => {
          let displayLine = line;

          if (
            index === maxLines - 1 &&
            lines.length > maxLines &&
            displayLine.length > 2
          ) {
            displayLine = displayLine.slice(0, -1) + "…";
          }

          ctx.fillText(
            displayLine,
            x,
            y + index * lineHeight
          );
        });
      };

      // =====================================================
      // BACKGROUND
      // =====================================================

      const bg = ctx.createLinearGradient(
        0,
        0,
        canvasWidth,
        canvasHeight
      );

      bg.addColorStop(0, theme.light);
      bg.addColorStop(0.55, "#ffffff");
      bg.addColorStop(1, "#f8fafc");

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Soft decorative circles
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = theme.accent;

      ctx.beginPath();
      ctx.arc(80, 170, 230, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(canvasWidth - 50, 420, 250, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(100, canvasHeight - 50, 280, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;

      // =====================================================
      // HEADER
      // =====================================================

      const headerH = 285;

      const headerGradient = ctx.createLinearGradient(
        0,
        0,
        canvasWidth,
        headerH
      );

      headerGradient.addColorStop(0, theme.top);
      headerGradient.addColorStop(1, theme.bottom);

      ctx.fillStyle = headerGradient;
      ctx.fillRect(0, 0, canvasWidth, headerH);

      // Gold accent strip
      ctx.fillStyle = theme.accent;
      ctx.fillRect(0, headerH - 10, canvasWidth, 10);

      // Header decorative circle
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.arc(1100, 40, 210, 0, Math.PI * 2);
      ctx.fill();

      // Icon
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold 62px ${fontFamily}`;
      ctx.textAlign = "left";
      ctx.fillText(theme.icon, 55, 75);

      // Main office heading
      ctx.font = `bold 42px ${fontFamily}`;
      ctx.fillText(
        "दैनिक कार्यक्रम प्रबंधन",
        55,
        135
      );

      ctx.font = `22px ${fontFamily}`;
      ctx.fillStyle = "#dbeafe";
      ctx.fillText(
        "Daily Program Management System",
        58,
        170
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold 31px ${fontFamily}`;
      ctx.fillText(
        theme.name,
        58,
        225
      );

      ctx.fillStyle = "#e2e8f0";
      ctx.font = `19px ${fontFamily}`;
      ctx.fillText(
        theme.subtitle,
        60,
        258
      );

      // Date badge
      const dateText = formatDate(selectedDate);
      const badgeW = 500;
      const badgeH = 72;
      const badgeX = canvasWidth - badgeW - 50;
      const badgeY = 75;

      ctx.fillStyle = "rgba(255,255,255,0.14)";
      roundRect(badgeX + 6, badgeY + 7, badgeW, badgeH, 18);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      roundRect(badgeX, badgeY, badgeW, badgeH, 18);
      ctx.fill();

      ctx.fillStyle = theme.dark;
      ctx.font = `bold 24px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.fillText(
        dateText,
        badgeX + badgeW / 2,
        badgeY + 43
      );

      // Count badge
      const countY = 205;
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(badgeX + 28, countY, 23, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.dark;
      ctx.font = `bold 19px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.fillText(
        String(selectedDatePrograms.length),
        badgeX + 28,
        countY + 1
      );

      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold 18px ${fontFamily}`;
      ctx.fillText(
        "कुल निर्धारित कार्यक्रम",
        badgeX + 62,
        countY + 6
      );

      // =====================================================
      // CATEGORY SUMMARY
      // =====================================================

      const summaryY = 325;

      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(15,23,42,0.12)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 5;
      roundRect(45, summaryY, canvasWidth - 90, 105, 24);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.fillStyle = theme.dark;
      ctx.font = `bold 20px ${fontFamily}`;
      ctx.textAlign = "left";
      ctx.fillText(
        "आज की गतिविधियाँ",
        75,
        summaryY + 35
      );

      let summaryX = 75;
      const maxSummary = Math.min(sortedCategories.length, 4);

      for (let i = 0; i < maxSummary; i++) {
        const [category, count] = sortedCategories[i];

        const label =
          `${category} (${count})`;

        ctx.font = `16px ${fontFamily}`;
        const pillW = Math.min(
          250,
          Math.max(125, ctx.measureText(label).width + 35)
        );

        if (summaryX + pillW > canvasWidth - 70) break;

        ctx.fillStyle =
          i === 0
            ? theme.accent
            : "#e2e8f0";

        roundRect(
          summaryX,
          summaryY + 52,
          pillW,
          38,
          19
        );
        ctx.fill();

        ctx.fillStyle =
          i === 0
            ? theme.dark
            : "#475569";

        ctx.textAlign = "center";
        ctx.fillText(
          label,
          summaryX + pillW / 2,
          summaryY + 72
        );

        summaryX += pillW + 10;
      }

      // =====================================================
      // PROGRAM CARDS
      // =====================================================

      const startY = 455;
      const side = 55;
      const cardW = canvasWidth - side * 2;
      const cardH =
        selectedDatePrograms.length <= 5
          ? 205
          : selectedDatePrograms.length <= 8
          ? 175
          : 142;

      const gap = 18;

      selectedDatePrograms.forEach((program, index) => {
        const y = startY + index * (cardH + gap);

        // New page if required
        if (y + cardH > canvasHeight - 105) {
          // This branch is handled below through page generation.
        }
      });

      // For a long day, create pages with the same dynamically selected theme.
      const recordsPerPage =
        selectedDatePrograms.length <= 5
          ? 5
          : selectedDatePrograms.length <= 8
          ? 6
          : 8;

      const totalPages = Math.ceil(
        selectedDatePrograms.length / recordsPerPage
      );

      const drawProgramPage = (
        pagePrograms: Program[],
        pageNumber: number
      ) => {
        // First page keeps header + summary. Other pages use compact header.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Background
        const pageBg = ctx.createLinearGradient(
          0,
          0,
          canvasWidth,
          canvasHeight
        );
        pageBg.addColorStop(0, theme.light);
        pageBg.addColorStop(0.5, "#ffffff");
        pageBg.addColorStop(1, "#f8fafc");

        ctx.fillStyle = pageBg;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        if (pageNumber === 1) {
          // Re-draw first page header and summary by calling the
          // same drawing logic inline.

          const headerGradient2 = ctx.createLinearGradient(
            0,
            0,
            canvasWidth,
            headerH
          );
          headerGradient2.addColorStop(0, theme.top);
          headerGradient2.addColorStop(1, theme.bottom);

          ctx.fillStyle = headerGradient2;
          ctx.fillRect(0, 0, canvasWidth, headerH);

          ctx.fillStyle = theme.accent;
          ctx.fillRect(0, headerH - 10, canvasWidth, 10);

          ctx.fillStyle = "#ffffff";
          ctx.font = `bold 42px ${fontFamily}`;
          ctx.textAlign = "left";
          ctx.fillText(
            "दैनिक कार्यक्रम प्रबंधन",
            55,
            135
          );

          ctx.font = `bold 31px ${fontFamily}`;
          ctx.fillText(
            theme.name,
            58,
            225
          );

          ctx.fillStyle = "#e2e8f0";
          ctx.font = `19px ${fontFamily}`;
          ctx.fillText(
            theme.subtitle,
            60,
            258
          );

          ctx.fillStyle = "#ffffff";
          roundRect(
            canvasWidth - 550,
            75,
            500,
            72,
            18
          );
          ctx.fill();

          ctx.fillStyle = theme.dark;
          ctx.font = `bold 24px ${fontFamily}`;
          ctx.textAlign = "center";
          ctx.fillText(
            dateText,
            canvasWidth - 300,
            118
          );

          ctx.fillStyle = "#ffffff";
          ctx.font = `bold 18px ${fontFamily}`;
          ctx.textAlign = "left";
          ctx.fillText(
            `कुल कार्यक्रम: ${selectedDatePrograms.length}`,
            canvasWidth - 540,
            205
          );

          // Summary
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(15,23,42,0.12)";
          ctx.shadowBlur = 18;
          ctx.shadowOffsetY = 5;
          roundRect(45, summaryY, canvasWidth - 90, 105, 24);
          ctx.fill();
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          ctx.fillStyle = theme.dark;
          ctx.font = `bold 20px ${fontFamily}`;
          ctx.textAlign = "left";
          ctx.fillText(
            "आज की गतिविधियाँ",
            75,
            summaryY + 35
          );

          let sx = 75;

          sortedCategories.slice(0, 4).forEach(
            ([category, count], i) => {
              const label = `${category} (${count})`;

              ctx.font = `16px ${fontFamily}`;
              const pw = Math.min(
                250,
                Math.max(125, ctx.measureText(label).width + 35)
              );

              if (sx + pw <= canvasWidth - 70) {
                ctx.fillStyle =
                  i === 0
                    ? theme.accent
                    : "#e2e8f0";

                roundRect(
                  sx,
                  summaryY + 52,
                  pw,
                  38,
                  19
                );
                ctx.fill();

                ctx.fillStyle =
                  i === 0
                    ? theme.dark
                    : "#475569";

                ctx.textAlign = "center";
                ctx.fillText(
                  label,
                  sx + pw / 2,
                  summaryY + 72
                );

                sx += pw + 10;
              }
            }
          );
        } else {
          // Compact header for continuation pages
          const compact = ctx.createLinearGradient(
            0,
            0,
            canvasWidth,
            130
          );
          compact.addColorStop(0, theme.top);
          compact.addColorStop(1, theme.bottom);

          ctx.fillStyle = compact;
          ctx.fillRect(0, 0, canvasWidth, 130);

          ctx.fillStyle = theme.accent;
          ctx.fillRect(0, 120, canvasWidth, 10);

          ctx.fillStyle = "#ffffff";
          ctx.font = `bold 31px ${fontFamily}`;
          ctx.textAlign = "left";
          ctx.fillText(
            theme.name,
            55,
            62
          );

          ctx.font = `18px ${fontFamily}`;
          ctx.fillText(
            `${dateText}  •  पृष्ठ ${pageNumber}`,
            58,
            98
          );
        }

        const localCardH =
          pageNumber === 1
            ? pagePrograms.length <= 5
              ? 205
              : pagePrograms.length <= 6
              ? 175
              : 145
            : pagePrograms.length <= 6
            ? 220
            : 180;

        const localGap = 16;
        const localStart =
          pageNumber === 1
            ? 455
            : 170;

        pagePrograms.forEach(
          (program, rowIndex) => {
            const y =
              localStart +
              rowIndex * (localCardH + localGap);

            // Card shadow
            ctx.fillStyle =
              "rgba(15,23,42,0.13)";
            roundRect(
              side + 8,
              y + 8,
              cardW,
              localCardH,
              22
            );
            ctx.fill();

            // Main card
            const cardGradient =
              ctx.createLinearGradient(
                side,
                y,
                side + cardW,
                y + localCardH
              );

            cardGradient.addColorStop(
              0,
              "#ffffff"
            );
            cardGradient.addColorStop(
              1,
              theme.light
            );

            ctx.fillStyle = cardGradient;
            roundRect(
              side,
              y,
              cardW,
              localCardH,
              22
            );
            ctx.fill();

            // Left category/time panel
            const panelW = 210;

            ctx.fillStyle = theme.dark;
            roundRect(
              side,
              y,
              panelW,
              localCardH,
              22
            );
            ctx.fill();

            // Remove rounding visually on right side of panel
            ctx.fillRect(
              side + panelW - 22,
              y,
              22,
              localCardH
            );

            // Serial
            ctx.fillStyle = theme.accent;
            ctx.beginPath();
            ctx.arc(
              side + 48,
              y + 45,
              26,
              0,
              Math.PI * 2
            );
            ctx.fill();

            ctx.fillStyle = theme.dark;
            ctx.font =
              `bold 18px ${fontFamily}`;
            ctx.textAlign = "center";
            ctx.fillText(
              String(
                (pageNumber - 1) *
                  recordsPerPage +
                  rowIndex +
                  1
              ),
              side + 48,
              y + 51
            );

            // Time
            ctx.fillStyle = "#ffffff";
            ctx.font =
              `bold 29px ${fontFamily}`;
            ctx.fillText(
              formatTime(program.program_time),
              side + panelW / 2,
              y + 95
            );

            ctx.fillStyle = "#cbd5e1";
            ctx.font =
              `14px ${fontFamily}`;
            ctx.fillText(
              program.category || "अन्य",
              side + panelW / 2,
              y + 132
            );

            // Main content
            const contentX =
              side + panelW + 35;

            ctx.textAlign = "left";
            ctx.fillStyle = theme.dark;
            ctx.font =
              `bold 24px ${fontFamily}`;

            drawWrapped(
              program.title || "कार्यक्रम",
              contentX,
              y + 45,
              cardW - panelW - 70,
              29,
              `bold 24px ${fontFamily}`,
              "left",
              2
            );

            // Location
            ctx.fillStyle = "#475569";
            ctx.font =
              `17px ${fontFamily}`;

            drawWrapped(
              `📍 ${program.location || "स्थान उपलब्ध नहीं"}`,
              contentX,
              y + 105,
              cardW - panelW - 70,
              22,
              `17px ${fontFamily}`,
              "left",
              2
            );

            // Sender / mobile
            const extra =
              [
                program.sender_name
                  ? `👤 ${program.sender_name}`
                  : "",
                program.mobile_number
                  ? `📱 ${program.mobile_number}`
                  : "",
              ]
                .filter(Boolean)
                .join("   ");

            if (extra) {
              ctx.fillStyle = "#64748b";
              ctx.font =
                `15px ${fontFamily}`;

              drawWrapped(
                extra,
                contentX,
                y + localCardH - 32,
                cardW - panelW - 70,
                20,
                `15px ${fontFamily}`,
                "left",
                1
              );
            }

            // Category accent line
            ctx.fillStyle = theme.accent;
            roundRect(
              side + panelW + 35,
              y + localCardH - 12,
              Math.min(
                130,
                cardW - panelW - 70
              ),
              5,
              3
            );
            ctx.fill();
          }
        );

        // Footer
        ctx.fillStyle = "#64748b";
        ctx.font =
          `14px ${fontFamily}`;
        ctx.textAlign = "center";
        ctx.fillText(
          `दैनिक कार्यक्रम प्रबंधन प्रणाली  •  ${dateText}  •  पृष्ठ ${pageNumber}/${totalPages}`,
          canvasWidth / 2,
          canvasHeight - 32
        );
      };

      for (
        let page = 0;
        page < totalPages;
        page++
      ) {
        if (page > 0) {
          pdf.addPage();
        }

        const pagePrograms =
          selectedDatePrograms.slice(
            page * recordsPerPage,
            (page + 1) * recordsPerPage
          );

        drawProgramPage(
          pagePrograms,
          page + 1
        );

        const imageData =
          canvas.toDataURL("image/jpeg", 0.96);

        pdf.addImage(
          imageData,
          "JPEG",
          0,
          0,
          210,
          297,
          undefined,
          "FAST"
        );
      }

      const fileDate = selectedDate
        .split("-")
        .reverse()
        .join("-");

      pdf.save(
        `Daily-Program-Smart-Design-${fileDate}.pdf`
      );
    } catch (error) {
      console.error(error);
      alert(
        "Smart PDF download नहीं हो सकी। कृपया Console में error देखें।"
      );
    } finally {
      setPdfLoading(false);
    }
  };

  // =========================================================
  // VAIVAHIK / SHOK MESSAGE PDF
  // Reference-style A4 Portrait शुभकामना / शोक संदेश design
  // =========================================================

  const downloadMessagePdf = async (
    program: Program,
    type: "marriage" | "condolence"
  ) => {
    try {
      // ---------------------------------------------------------
      // Common PDF setup
      // ---------------------------------------------------------
      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "landscape",
      });

      const background = new Image();
      background.src = "/assets/shubhkamna-bg.jpg";

      await new Promise<void>((resolve, reject) => {
        background.onload = () => resolve();
        background.onerror = () =>
          reject(
            new Error(
              "Background image नहीं मिली। public/assets/shubhkamna-bg.jpg रखें।"
            )
          );
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Canvas उपलब्ध नहीं है।");
      }

      const W = 1400;
      const H = 990;
      canvas.width = W;
      canvas.height = H;

      const fontFamily =
        '"Nirmala UI", "Mangal", Arial, sans-serif';

      const wrapText = (
        value: string,
        maxWidth: number,
        font: string
      ) => {
        ctx.font = font;

        const chars = Array.from(value || "");
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

        return lines;
      };

      const drawText = (
        textValue: string,
        x: number,
        y: number,
        maxWidth: number,
        font: string,
        color: string,
        lineHeight: number,
        maxLines = 6,
        align: CanvasTextAlign = "left"
      ) => {
        const lines = wrapText(
          textValue,
          maxWidth,
          font
        ).slice(0, maxLines);

        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = "top";

        lines.forEach((line, index) => {
          ctx.fillText(
            line,
            x,
            y + index * lineHeight
          );
        });

        return lines.length;
      };

      const drawBackground = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);

        const imageRatio =
          background.width / background.height;
        const canvasRatio = W / H;

        let drawW = W;
        let drawH = H;
        let drawX = 0;
        let drawY = 0;

        if (imageRatio > canvasRatio) {
          drawH = H;
          drawW = H * imageRatio;
          drawX = (W - drawW) / 2;
        } else {
          drawW = W;
          drawH = W / imageRatio;
          drawY = (H - drawH) / 2;
        }

        ctx.drawImage(
          background,
          drawX,
          drawY,
          drawW,
          drawH
        );

        // Shok PDF में background को थोड़ा sober रखें।
        if (type === "condolence") {
          ctx.fillStyle =
            "rgba(255,255,255,0.18)";
          ctx.fillRect(0, 0, W, H);
        }
      };

      // =========================================================
      // VAIVAHIK — उस तारीख की हर शादी = एक PDF page
      // =========================================================
      if (type === "marriage") {
        const marriagePrograms = programs
          .filter(
            (p) =>
              p.program_date === program.program_date &&
              p.category === "वैवाहिक"
          )
          .sort((a, b) =>
            (a.program_time || "").localeCompare(
              b.program_time || ""
            )
          );

        if (marriagePrograms.length === 0) {
          alert(
            "इस तारीख के लिए कोई वैवाहिक कार्यक्रम नहीं मिला।"
          );
          return;
        }

        const datePart = program.program_date
          ? program.program_date
              .split("-")
              .reverse()
              .join("-")
          : "date";

        marriagePrograms.forEach(
          (marriageProgram, index) => {
            if (index > 0) {
              pdf.addPage();
            }

            drawBackground();

            ctx.textAlign = "center";
            ctx.textBaseline = "top";

            ctx.shadowColor =
              "rgba(255,255,255,0.95)";
            ctx.shadowBlur = 8;

            ctx.font =
              `bold 58px ${fontFamily}`;
            ctx.fillStyle = "#c51f1f";

            ctx.fillText(
              "शुभकामना सन्देश",
              700,
              72
            );

            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;

            ctx.font =
              `bold 16px ${fontFamily}`;
            ctx.fillStyle = "#7c2d12";
            ctx.textAlign = "right";

            ctx.fillText(
              `विवाह ${index + 1} / ${marriagePrograms.length}`,
              1325,
              92
            );

            const recipient =
              (marriageProgram.sender_name || "").trim();

            drawText(
              "श्रद्धेय,",
              105,
              220,
              850,
              `bold 30px ${fontFamily}`,
              "#111827",
              38,
              1,
              "left"
            );

            if (recipient) {
              drawText(
                recipient,
                105,
                270,
                850,
                `bold 34px ${fontFamily}`,
                "#c51f1f",
                42,
                2,
                "left"
              );
            }

            const groom =
              (marriageProgram.groom_name || "").trim();

            const bride =
              (marriageProgram.bride_name || "").trim();

            const couple =
              groom && bride
                ? `चि. ${groom} संग सौ.का. ${bride}`
                : groom
                ? `चि. ${groom}`
                : bride
                ? `सौ.का. ${bride}`
                : "नवदंपत्ति";

            const contentX = 105;
            const contentW = 850;

            drawText(
              couple,
              contentX,
              390,
              contentW,
              `bold 34px ${fontFamily}`,
              "#1748d1",
              43,
              2,
              "left"
            );

            drawText(
              "के परिणय बंधन के शुभ अवसर पर ईश्वर से यही प्रार्थना है कि नवदंपत्ति का वैवाहिक जीवन सदा सुखमय रहे। विवाह का यह पवित्र बंधन आपके कुल की वृद्धि एवं और सम्पन्नता का कारक बने।",
              contentX,
              475,
              contentW,
              `27px ${fontFamily}`,
              "#111827",
              40,
              5,
              "left"
            );

            drawText(
              "नवदंपत्योः वैवाहिक जीवनं सुखमयं भवतु।",
              contentX + contentW / 2,
              690,
              700,
              `bold 34px ${fontFamily}`,
              "#c51f1f",
              42,
              2,
              "center"
            );

            drawText(
              "शुभाकांक्षी",
              1060,
              650,
              260,
              `bold 27px ${fontFamily}`,
              "#111827",
              34,
              1,
              "center"
            );

            drawText(
              "(मुकेश टटवाल)",
              1060,
              690,
              300,
              `bold 30px ${fontFamily}`,
              "#c51f1f",
              38,
              1,
              "center"
            );

            drawText(
              "महापौर, उज्जैन",
              1060,
              735,
              300,
              `bold 27px ${fontFamily}`,
              "#111827",
              34,
              1,
              "center"
            );

            ctx.fillStyle =
              "rgba(255,255,255,0.90)";
            ctx.fillRect(
              55,
              820,
              W - 110,
              55
            );

            ctx.textAlign = "center";
            ctx.font =
              `16px ${fontFamily}`;
            ctx.fillStyle = "#1f2937";

            ctx.fillText(
              "Website - nagarnigamujjain.org  |  Email - mayorujjain-mp@mp.gov.in  |  nn.ujjain@mp.gov.in",
              W / 2,
              840
            );

            ctx.fillStyle = "#16a34a";
            ctx.fillRect(
              55,
              875,
              W - 110,
              50
            );

            ctx.fillStyle = "#ffffff";
            ctx.font =
              `bold 19px ${fontFamily}`;

            ctx.fillText(
              "छत्रपति शिवाजी भवन, आगर रोड उज्जैन (म.प्र.)",
              W / 2,
              890
            );

            ctx.fillStyle = "#374151";
            ctx.font =
              `15px ${fontFamily}`;
            ctx.textAlign = "right";

            ctx.fillText(
              datePart,
              W - 60,
              950
            );

            const imageData =
              canvas.toDataURL("image/jpeg", 0.97);

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
        );

        pdf.save(
          `Shubhkamna-Sandesh-${datePart}-${marriagePrograms.length}-Vivah.pdf`
        );

        return;
      }

      // =========================================================
      // SHOK — एक entry = एक page
      // =========================================================
      if (type === "condolence") {
        drawBackground();

        const datePart = program.program_date
          ? program.program_date
              .split("-")
              .reverse()
              .join("-")
          : "date";

        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        ctx.shadowColor =
          "rgba(255,255,255,0.95)";
        ctx.shadowBlur = 8;

        ctx.font =
          `bold 56px ${fontFamily}`;
        ctx.fillStyle = "#334155";

        ctx.fillText(
          "शोक संवेदना सन्देश",
          700,
          75
        );

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        ctx.textAlign = "left";

        drawText(
          "श्रद्धेय,",
          105,
          220,
          850,
          `bold 30px ${fontFamily}`,
          "#111827",
          38,
          1,
          "left"
        );

        const recipient =
          (program.sender_name || "").trim();

        if (recipient) {
          drawText(
            recipient,
            105,
            270,
            850,
            `bold 34px ${fontFamily}`,
            "#475569",
            42,
            2,
            "left"
          );
        }

        const deceased =
          (program.deceased_name || "").trim();

        drawText(
          `स्वर्गीय ${deceased || "दिवंगत आत्मा"}`,
          105,
          390,
          850,
          `bold 34px ${fontFamily}`,
          "#334155",
          43,
          2,
          "left"
        );

        drawText(
          "के निधन का समाचार अत्यंत दुःखद एवं पीड़ादायक है। ईश्वर दिवंगत आत्मा को अपने श्रीचरणों में स्थान प्रदान करें तथा शोकाकुल परिजनों को इस अपार दुःख को सहन करने की शक्ति प्रदान करें।",
          105,
          475,
          850,
          `27px ${fontFamily}`,
          "#111827",
          40,
          5,
          "left"
        );

        drawText(
          "ॐ शांति। शांति। शांति।",
          525,
          690,
          500,
          `bold 34px ${fontFamily}`,
          "#475569",
          42,
          2,
          "center"
        );

        // शोक संदेश में "शुभाकांक्षी" नहीं होगा,
        // लेकिन नाम और पद दिखाई देंगे।
        drawText(
          "(मुकेश टटवाल)",
          1060,
          690,
          300,
          `bold 30px ${fontFamily}`,
          "#475569",
          38,
          1,
          "center"
        );

        drawText(
          "महापौर, उज्जैन",
          1060,
          735,
          300,
          `bold 27px ${fontFamily}`,
          "#111827",
          34,
          1,
          "center"
        );

        ctx.fillStyle =
          "rgba(255,255,255,0.90)";
        ctx.fillRect(
          55,
          820,
          W - 110,
          55
        );

        ctx.textAlign = "center";
        ctx.font =
          `16px ${fontFamily}`;
        ctx.fillStyle = "#1f2937";

        ctx.fillText(
          "Website - nagarnigamujjain.org  |  Email - mayorujjain-mp@mp.gov.in  |  nn.ujjain@mp.gov.in",
          W / 2,
          840
        );

        ctx.fillStyle = "#64748b";
        ctx.fillRect(
          55,
          875,
          W - 110,
          50
        );

        ctx.fillStyle = "#ffffff";
        ctx.font =
          `bold 19px ${fontFamily}`;

        ctx.fillText(
          "छत्रपति शिवाजी भवन, आगर रोड उज्जैन (म.प्र.)",
          W / 2,
          890
        );

        ctx.fillStyle = "#374151";
        ctx.font =
          `15px ${fontFamily}`;
        ctx.textAlign = "right";

        ctx.fillText(
          datePart,
          W - 60,
          950
        );

        const imageData =
          canvas.toDataURL("image/jpeg", 0.97);

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

        const safeName = (
          deceased || "Shok"
        )
          .replace(/[\\/:*?"<>|]/g, "-")
          .slice(0, 70);

        pdf.save(
          `Shok-Sandesh-${safeName}-${datePart}.pdf`
        );
      }
    } catch (error) {
      console.error(error);
      alert(
        "संदेश PDF नहीं बन सकी। कृपया Console में error देखें।"
      );
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