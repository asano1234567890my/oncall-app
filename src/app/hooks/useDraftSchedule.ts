// src/app/hooks/useDraftSchedule.ts — 仮保存（ドラフト）管理フック
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthHeaders } from "./useAuth";
import type { ScheduleRow } from "../types/dashboard";

const apiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function useDraftSchedule(year: number, month: number, isAuthenticated: boolean) {
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const checkedRef = useRef("");

  // 月変更時にドラフト有無を確認
  useEffect(() => {
    if (!isAuthenticated) return;
    const key = `${year}-${month}`;
    if (checkedRef.current === key) return;
    checkedRef.current = key;

    fetch(`${apiBase()}/api/schedule/draft/${year}/${month}`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data: unknown) => {
        const d = data as Record<string, unknown>;
        setDraftSavedAt((d?.saved_at as string) ?? null);
      })
      .catch(() => setDraftSavedAt(null));
  }, [year, month, isAuthenticated]);

  const saveDraft = useCallback(async (schedule: ScheduleRow[]) => {
    setIsDraftSaving(true);
    setDraftMessage("");
    try {
      const body = {
        schedule: schedule.map((row) => ({
          day: row.day,
          day_shift: row.day_shift ?? null,
          night_shift: row.night_shift ?? null,
        })),
      };
      const res = await fetch(`${apiBase()}/api/schedule/draft/${year}/${month}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("仮保存に失敗しました");
      const data = (await res.json()) as Record<string, unknown>;
      const savedAt = (data.saved_at as string) ?? null;
      setDraftSavedAt(savedAt);
      setDraftMessage("仮保存しました");
      setTimeout(() => setDraftMessage(""), 2000);
      return savedAt;
    } catch {
      setDraftMessage("仮保存に失敗しました");
      return null;
    } finally {
      setIsDraftSaving(false);
    }
  }, [year, month]);

  const loadDraft = useCallback(async (): Promise<ScheduleRow[] | null> => {
    setIsDraftLoading(true);
    setDraftMessage("");
    try {
      const res = await fetch(`${apiBase()}/api/schedule/draft/${year}/${month}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("読み込みに失敗しました");
      const data = (await res.json()) as Record<string, unknown>;
      const schedule = data.schedule as Array<Record<string, unknown>> | null;
      if (!schedule) {
        setDraftMessage("仮保存データがありません");
        return null;
      }
      setDraftMessage("仮保存を読み込みました");
      setTimeout(() => setDraftMessage(""), 2000);
      return schedule.map((row) => ({
        day: row.day as number,
        day_shift: (row.day_shift as string) ?? null,
        night_shift: (row.night_shift as string) ?? null,
      })) as ScheduleRow[];
    } catch {
      setDraftMessage("仮保存の読み込みに失敗しました");
      return null;
    } finally {
      setIsDraftLoading(false);
    }
  }, [year, month]);

  const deleteDraft = useCallback(async () => {
    try {
      await fetch(`${apiBase()}/api/schedule/draft/${year}/${month}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setDraftSavedAt(null);
    } catch { /* ignore */ }
  }, [year, month]);

  const refreshDraftStatus = useCallback(() => {
    checkedRef.current = "";
  }, []);

  return {
    isDraftSaving,
    isDraftLoading,
    draftSavedAt,
    draftMessage,
    saveDraft,
    loadDraft,
    deleteDraft,
    refreshDraftStatus,
  };
}
