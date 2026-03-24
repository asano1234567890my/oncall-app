"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { X, Upload, Camera, Loader2, Check, AlertTriangle, Plus, ChevronRight, CalendarDays } from "lucide-react";
import { getAuthHeaders } from "../hooks/useAuth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Doctor = { id: string; name: string };

type ParsedShift = {
  day: number;
  day_shift: string | null;
  night_shift: string | null;
};

type ParsedResult = {
  year: number | null;
  month: number | null;
  shifts: ParsedShift[];
};

type DoctorMapping = {
  imageName: string;
  type: "matched" | "select" | "new";
  doctorId: string | null;
  newName: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  doctors: Doctor[];
  defaultYear: number;
  defaultMonth: number;
  hasExistingSchedule: boolean;
  onImported: () => void;
};

type Step = "upload" | "parsing" | "mapping" | "saving";

export default function ImageImportModal({
  open,
  onClose,
  doctors,
  defaultYear,
  defaultMonth,
  hasExistingSchedule,
  onImported,
}: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [error, setError] = useState("");

  // Parsed result
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [yearMonthGuessed, setYearMonthGuessed] = useState(false);

  // Holidays for target month
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]);

  // Shift mode from current config
  const [currentShiftMode, setCurrentShiftMode] = useState<"split" | "combined">("split");

  // Doctor mappings
  const [mappings, setMappings] = useState<DoctorMapping[]>([]);

  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setPreview("");
    setError("");
    setParsed(null);
    setYear(defaultYear);
    setMonth(defaultMonth);
    setYearMonthGuessed(false);
    setHolidays([]);
    setMappings([]);
  }, [defaultYear, defaultMonth]);

  const handleClose = () => {
    reset();
    onClose();
  };

  // Extract unique doctor names from parsed shifts
  const extractDoctorNames = (shifts: ParsedShift[]): string[] => {
    const names = new Set<string>();
    for (const s of shifts) {
      if (s.day_shift) names.add(s.day_shift);
      if (s.night_shift) names.add(s.night_shift);
    }
    return Array.from(names).sort();
  };

  // Auto-match: find best match from existing doctors
  const autoMatch = (imageName: string): Doctor | null => {
    // Exact match
    const exact = doctors.find((d) => d.name === imageName);
    if (exact) return exact;
    // Partial match (image name contained in doctor name or vice versa)
    const partial = doctors.find(
      (d) => d.name.includes(imageName) || imageName.includes(d.name),
    );
    if (partial) return partial;
    return null;
  };

  // Fetch holidays when mapping step is shown or year/month changes
  useEffect(() => {
    if (step !== "mapping") return;
    let cancelled = false;
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    fetch(`${API_BASE}/api/holidays/?year_month=${ym}`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled && Array.isArray(data)) setHolidays(data); })
      .catch(() => { if (!cancelled) setHolidays([]); });
    return () => { cancelled = true; };
  }, [step, year, month]);

  const ACCEPTED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/pdf",
    "text/plain", "text/csv",
  ];
  const ACCEPTED_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".xlsx", ".xls", ".docx", ".pdf", ".txt", ".csv"];
  const FILE_ACCEPT = "image/*,.xlsx,.xls,.docx,.pdf,.txt,.csv";

  const isAcceptedFile = (f: File): boolean => {
    if (ACCEPTED_TYPES.includes(f.type)) return true;
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
    return ACCEPTED_EXTS.includes(ext);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isAcceptedFile(f)) {
      setError("対応していないファイル形式です。画像・Excel・Word・PDF・テキストに対応しています。");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("ファイルサイズが大きすぎます（上限10MB）");
      return;
    }
    setError("");
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : "");
  };

  const handleParse = async () => {
    if (!file) return;
    setStep("parsing");
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/import/parse-image`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "画像の解析に失敗しました");
      }
      const result: ParsedResult = await res.json();
      setParsed(result);

      // Set year/month from parsed result or fallback to defaults
      const guessed = !result.year || !result.month;
      setYearMonthGuessed(guessed);
      if (result.year) setYear(result.year);
      if (result.month) setMonth(result.month);

      // Fetch current shift mode
      try {
        const cfgRes = await fetch(`${API_BASE}/api/settings/optimizer_config`, { headers: getAuthHeaders() });
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          setCurrentShiftMode(cfg?.hard_constraints?.holiday_shift_mode === "combined" ? "combined" : "split");
        }
      } catch { /* ignore */ }

      // Build initial mappings with auto-match
      const names = extractDoctorNames(result.shifts);
      const initialMappings: DoctorMapping[] = names.map((name) => {
        const matched = autoMatch(name);
        return {
          imageName: name,
          type: matched ? "matched" : "new",
          doctorId: matched?.id ?? null,
          newName: matched ? "" : name,
        };
      });
      setMappings(initialMappings);
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像の解析に失敗しました");
      setStep("upload");
    }
  };

  const handleMappingChange = (index: number, update: Partial<DoctorMapping>) => {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...update } : m)),
    );
  };

  const isValid = useMemo(() => {
    if (!parsed || mappings.length === 0) return false;
    return mappings.every(
      (m) => m.doctorId || (m.type === "new" && m.newName.trim()),
    );
  }, [parsed, mappings]);

  const handleConfirm = async () => {
    if (!parsed || !isValid) return;

    // Warn if existing schedule
    if (hasExistingSchedule) {
      if (
        !window.confirm(
          `${year}年${month}月の当直表は既に存在します。\n上書きしてよろしいですか？`,
        )
      )
        return;
    }

    if (!window.confirm("取り込みを実行します。よろしいですか？")) return;

    setStep("saving");
    setError("");
    try {
      const body = {
        year,
        month,
        shifts: parsed.shifts,
        doctor_mappings: mappings.map((m) => ({
          image_name: m.imageName,
          doctor_id: m.doctorId || null,
          new_name: m.type === "new" ? m.newName.trim() : null,
        })),
      };
      const res = await fetch(`${API_BASE}/api/import/confirm`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "保存に失敗しました");
      }
      const data = await res.json();
      window.alert(data.message || "保存しました");
      onImported();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setStep("mapping");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3 rounded-t-2xl">
          <h2 className="text-sm font-bold text-gray-800">ファイルから当直表を取り込む</h2>
          <button onClick={handleClose} className="rounded-full p-1 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* ── Step 1: Upload ── */}
          {step === "upload" && (
            <>
              <p className="text-xs text-gray-500">
                当直表の画像・Excel・Word・PDFなどをアップロードすると、AIが自動で読み取ります。
              </p>

              {!file ? (
                <div className="grid grid-cols-2 gap-3">
                  {/* カメラ撮影（スマホのみ有効、PCではファイル選択になる） */}
                  <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/30 p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <Camera className="h-8 w-8 text-blue-400" />
                    <span className="text-sm font-bold text-blue-600">カメラで撮影</span>
                    <span className="text-[10px] text-gray-400">当直表を撮影</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {/* ファイル選択 */}
                  <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 cursor-pointer hover:border-gray-400 hover:bg-gray-100/50 transition-colors">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <span className="text-sm font-bold text-gray-600">ファイルを選択</span>
                    <span className="text-[10px] text-gray-400">画像, Excel, Word, PDF</span>
                    <input
                      type="file"
                      accept={FILE_ACCEPT}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  {preview ? (
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <img
                        src={preview}
                        alt="プレビュー"
                        className="w-full max-h-60 object-contain bg-gray-100"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <Upload className="h-8 w-8 text-gray-400 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-gray-700">{file.name}</p>
                        <p className="text-[10px] text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 truncate max-w-[60%]">{file.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setFile(null); setPreview(""); }}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        変更
                      </button>
                      <button
                        onClick={() => { void handleParse(); }}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
                      >
                        読み取る
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Parsing (loading) ── */}
          {step === "parsing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-600 font-bold">画像を解析中...</p>
              <p className="text-[10px] text-gray-400">数秒〜十数秒かかる場合があります</p>
            </div>
          )}

          {/* ── Step 3: Mapping ── */}
          {step === "mapping" && parsed && (
            <>
              {/* Year/Month override */}
              <div className={`rounded-lg p-2.5 ${yearMonthGuessed ? "border border-amber-300 bg-amber-50" : ""}`}>
                {yearMonthGuessed && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-[10px] font-bold text-amber-700">年月を読み取れませんでした。正しい年月を確認してください。</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-xs text-gray-500">対象月:</span>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className={`h-7 w-16 rounded border px-2 text-center text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${yearMonthGuessed ? "border-amber-400 bg-white" : "border-gray-300"}`}
                  />
                  <span className="text-gray-400">年</span>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className={`h-7 rounded border px-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${yearMonthGuessed ? "border-amber-400 bg-white" : "border-gray-300"}`}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{m}月</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Holidays info */}
              {holidays.length > 0 && (
                <div className="flex items-start gap-1.5 rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                  <CalendarDays className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-blue-700">
                    <span className="font-bold">この月の祝日: </span>
                    {holidays.map((h, i) => (
                      <span key={h.date}>
                        {i > 0 && "、"}
                        {new Date(h.date).getDate()}日({h.name})
                      </span>
                    ))}
                    <p className="mt-0.5 text-blue-500">祝日設定はダッシュボードから確認・変更できます。</p>
                  </div>
                </div>
              )}

              {/* Shift mode mismatch detection */}
              {(() => {
                const hasDayShift = parsed.shifts.some((s) => s.day_shift);
                const hasNightShift = parsed.shifts.some((s) => s.night_shift);
                const importedMode = hasDayShift && hasNightShift ? "split" : "combined";
                if (importedMode !== currentShiftMode) {
                  return (
                    <div className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-[10px] text-amber-700">
                        {importedMode === "split" ? (
                          <><span className="font-bold">取込データに日直と当直が別々に含まれています。</span>現在の設定は「日当直（一体型）」です。取込後、ダッシュボードで設定を確認してください。</>
                        ) : (
                          <><span className="font-bold">取込データに日直が含まれていません。</span>現在の設定は「日直＋当直（分離型）」です。取込後、ダッシュボードで設定を確認してください。</>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Parsed shifts summary */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-bold text-gray-700 mb-1">
                  読み取り結果: {parsed.shifts.length}日分のシフト
                </p>
                <div className="max-h-32 overflow-y-auto text-[10px] text-gray-500 space-y-0.5">
                  {parsed.shifts.map((s) => (
                    <div key={s.day} className="flex gap-2">
                      <span className="w-6 text-right font-medium">{s.day}日</span>
                      {s.day_shift && <span>日直: {s.day_shift}</span>}
                      {s.night_shift && <span>当直: {s.night_shift}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Doctor name mappings */}
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">医師名の対応付け</p>
                <div className="space-y-2">
                  {mappings.map((m, i) => (
                    <div key={m.imageName} className="rounded-lg border border-gray-200 p-2.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-800">「{m.imageName}」</span>
                        {m.type === "matched" && m.doctorId && (
                          <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                            <Check className="h-3 w-3" /> 自動一致
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={m.doctorId ?? "__new__"}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "__new__") {
                              handleMappingChange(i, { type: "new", doctorId: null, newName: m.imageName });
                            } else {
                              handleMappingChange(i, { type: "select", doctorId: val, newName: "" });
                            }
                          }}
                          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="__new__">+ 新規作成</option>
                          {doctors.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      {m.type === "new" && !m.doctorId && (
                        <div className="flex items-center gap-1.5">
                          <Plus className="h-3.5 w-3.5 text-gray-400" />
                          <input
                            type="text"
                            value={m.newName}
                            onChange={(e) => handleMappingChange(i, { newName: e.target.value })}
                            placeholder="新規医師名"
                            className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirm button */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { reset(); }}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  やり直す
                </button>
                <button
                  onClick={() => { void handleConfirm(); }}
                  disabled={!isValid}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {hasExistingSchedule ? "上書き保存" : "保存する"}
                </button>
              </div>
            </>
          )}

          {/* ── Step 4: Saving ── */}
          {step === "saving" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-600 font-bold">保存中...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
