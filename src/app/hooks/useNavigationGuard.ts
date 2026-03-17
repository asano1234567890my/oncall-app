// src/app/hooks/useNavigationGuard.ts
import { useEffect, useRef } from "react";
import {
  DEFAULT_HARD_CONSTRAINTS,
  DEFAULT_OBJECTIVE_WEIGHTS,
  type HardConstraints,
  type ObjectiveWeights,
  type ScheduleRow,
} from "../types/dashboard";

export const getScheduleSignature = (rows: ScheduleRow[]) =>
  JSON.stringify(
    rows.map((row) => ({
      day: row.day,
      day_shift: row.day_shift ?? null,
      night_shift: row.night_shift ?? null,
      is_holiday: Boolean(row.is_holiday),
      is_sunhol: Boolean(row.is_sunhol),
    }))
  );

type UseNavigationGuardParams = {
  dirtyRef: React.MutableRefObject<boolean>;
  savedScheduleSignatureRef: React.MutableRefObject<string>;
  latestScheduleRef: React.MutableRefObject<ScheduleRow[]>;
  setIsDirty: (value: boolean) => void;
  getUnsavedDoctorNames: () => string[];
  hasUnsavedCustomChanges: boolean;
  objectiveWeights: ObjectiveWeights;
  hardConstraints: HardConstraints;
};

export function useNavigationGuard({
  dirtyRef,
  savedScheduleSignatureRef,
  latestScheduleRef,
  setIsDirty,
  getUnsavedDoctorNames,
  hasUnsavedCustomChanges,
  objectiveWeights,
  hardConstraints,
}: UseNavigationGuardParams): void {
  const ignoreNextPopStateRef = useRef(false);
  const getUnsavedDoctorNamesRef = useRef(getUnsavedDoctorNames);
  getUnsavedDoctorNamesRef.current = getUnsavedDoctorNames;
  const hasUnsavedCustomChangesRef = useRef(hasUnsavedCustomChanges);
  hasUnsavedCustomChangesRef.current = hasUnsavedCustomChanges;
  const objectiveWeightsRef = useRef(objectiveWeights);
  objectiveWeightsRef.current = objectiveWeights;
  const hardConstraintsRef = useRef(hardConstraints);
  hardConstraintsRef.current = hardConstraints;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const confirmNavigationAway = () => {
      const lines: string[] = [];
      if (dirtyRef.current) lines.push("シフトが保存されていません。");
      const unsavedDoctors = getUnsavedDoctorNamesRef.current();
      if (unsavedDoctors.length > 0) lines.push(`${unsavedDoctors.join("、")}先生の設定が未登録です。`);
      if (hasUnsavedCustomChangesRef.current) lines.push("祝日設定が保存されていません。");
      const weightKeys = Object.keys(DEFAULT_OBJECTIVE_WEIGHTS) as (keyof ObjectiveWeights)[];
      if (weightKeys.some((k) => objectiveWeightsRef.current[k] !== DEFAULT_OBJECTIVE_WEIGHTS[k])) {
        lines.push("重みづけ設定がデフォルトから変更されています。");
      }
      if (JSON.stringify(hardConstraintsRef.current) !== JSON.stringify(DEFAULT_HARD_CONSTRAINTS)) {
        lines.push("ハード制約設定がデフォルトから変更されています。");
      }

      if (lines.length === 0) return true;

      lines.push("そのまま移動してよいですか？");
      const confirmed = window.confirm(lines.join("\n"));
      if (confirmed) {
        savedScheduleSignatureRef.current = getScheduleSignature(latestScheduleRef.current);
        dirtyRef.current = false;
        setIsDirty(false);
      }
      return confirmed;
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.origin !== currentUrl.origin) return;
      if (nextUrl.href === currentUrl.href) return;

      if (!confirmNavigationAway()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handlePopState = () => {
      if (ignoreNextPopStateRef.current) {
        ignoreNextPopStateRef.current = false;
        return;
      }

      if (confirmNavigationAway()) {
        return;
      }

      ignoreNextPopStateRef.current = true;
      window.history.go(1);
    };

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [setIsDirty]);
}
