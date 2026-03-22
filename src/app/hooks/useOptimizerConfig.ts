import { useEffect, useRef, useState } from "react";
import { DEFAULT_HARD_CONSTRAINTS, DEFAULT_OBJECTIVE_WEIGHTS, DEFAULT_SHIFT_SCORES, type HardConstraints, type ObjectiveWeights, type ShiftScores } from "../types/dashboard";
import { getAuthHeaders } from "./useAuth";
import type { WeightRatioOverrides } from "../components/settings/shared";

type UseOptimizerConfigParams = {
  scoreMin: number;
  scoreMax: number;
  scoreTargetDefault: number | null;
  shiftScores: ShiftScores;
  objectiveWeights: ObjectiveWeights;
  hardConstraints: HardConstraints;
  weightRatioOverrides: WeightRatioOverrides;
  setScoreMin: (v: number) => void;
  setScoreMax: (v: number) => void;
  setScoreTargetDefault: (v: number | null) => void;
  setShiftScores: (v: ShiftScores) => void;
  setObjectiveWeights: (v: ObjectiveWeights) => void;
  setHardConstraints: (v: HardConstraints) => void;
  setWeightRatioOverrides: (v: WeightRatioOverrides) => void;
};

export function useOptimizerConfig({
  scoreMin,
  scoreMax,
  scoreTargetDefault,
  shiftScores,
  objectiveWeights,
  hardConstraints,
  weightRatioOverrides,
  setScoreMin,
  setScoreMax,
  setScoreTargetDefault,
  setShiftScores,
  setObjectiveWeights,
  setHardConstraints,
  setWeightRatioOverrides,
}: UseOptimizerConfigParams) {
  const [isSavingOptimizerConfig, setIsSavingOptimizerConfig] = useState(false);
  const [optimizerSaveMessage, setOptimizerSaveMessage] = useState("");
  const savedWeightsRef = useRef<string>(JSON.stringify(DEFAULT_OBJECTIVE_WEIGHTS));
  const savedHardRef = useRef<string>(JSON.stringify(DEFAULT_HARD_CONSTRAINTS));

  useEffect(() => {
    const load = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${apiUrl}/api/settings/optimizer_config`, { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (!data || typeof data !== "object") return;
        const cfg = data as Record<string, unknown>;
        if (typeof cfg.score_min === "number") setScoreMin(cfg.score_min);
        if (typeof cfg.score_max === "number") setScoreMax(cfg.score_max);
        if (cfg.score_target_default === null || typeof cfg.score_target_default === "number") setScoreTargetDefault(cfg.score_target_default as number | null);
        if (cfg.shift_scores && typeof cfg.shift_scores === "object") {
          setShiftScores({ ...DEFAULT_SHIFT_SCORES, ...(cfg.shift_scores as Partial<ShiftScores>) });
        }
        if (cfg.objective_weights && typeof cfg.objective_weights === "object") {
          const merged = { ...DEFAULT_OBJECTIVE_WEIGHTS, ...(cfg.objective_weights as Partial<ObjectiveWeights>) };
          setObjectiveWeights(merged);
          savedWeightsRef.current = JSON.stringify(merged);
        }
        if (cfg.hard_constraints && typeof cfg.hard_constraints === "object") {
          const merged = { ...DEFAULT_HARD_CONSTRAINTS, ...(cfg.hard_constraints as Partial<HardConstraints>) };
          setHardConstraints(merged);
          savedHardRef.current = JSON.stringify(merged);
        }
        if (cfg.weight_ratios && typeof cfg.weight_ratios === "object") {
          setWeightRatioOverrides(cfg.weight_ratios as WeightRatioOverrides);
        }
      } catch {
        // サイレントに失敗（初回設定がなければデフォルト値のまま）
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveOptimizerConfig = async () => {
    setIsSavingOptimizerConfig(true);
    setOptimizerSaveMessage("");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/settings/optimizer_config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          score_min: scoreMin,
          score_max: scoreMax,
          score_target_default: scoreTargetDefault,
          shift_scores: shiftScores,
          objective_weights: objectiveWeights,
          hard_constraints: hardConstraints,
          weight_ratios: weightRatioOverrides,
        }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      savedWeightsRef.current = JSON.stringify(objectiveWeights);
      savedHardRef.current = JSON.stringify(hardConstraints);
      setOptimizerSaveMessage("保存しました");
      setTimeout(() => setOptimizerSaveMessage(""), 3000);
    } catch {
      setOptimizerSaveMessage("保存に失敗しました");
      setTimeout(() => setOptimizerSaveMessage(""), 4000);
    } finally {
      setIsSavingOptimizerConfig(false);
    }
  };

  const hasUnsavedWeights = JSON.stringify(objectiveWeights) !== savedWeightsRef.current;
  const hasUnsavedHardConstraints = JSON.stringify(hardConstraints) !== savedHardRef.current;

  return { isSavingOptimizerConfig, optimizerSaveMessage, saveOptimizerConfig, hasUnsavedWeights, hasUnsavedHardConstraints };
}
