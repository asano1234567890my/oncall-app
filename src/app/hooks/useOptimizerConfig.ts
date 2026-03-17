import { useEffect, useState } from "react";
import { DEFAULT_HARD_CONSTRAINTS, DEFAULT_OBJECTIVE_WEIGHTS, type HardConstraints, type ObjectiveWeights } from "../types/dashboard";
import { getAuthHeaders } from "./useAuth";

type UseOptimizerConfigParams = {
  scoreMin: number;
  scoreMax: number;
  objectiveWeights: ObjectiveWeights;
  hardConstraints: HardConstraints;
  setScoreMin: (v: number) => void;
  setScoreMax: (v: number) => void;
  setObjectiveWeights: (v: ObjectiveWeights) => void;
  setHardConstraints: (v: HardConstraints) => void;
};

export function useOptimizerConfig({
  scoreMin,
  scoreMax,
  objectiveWeights,
  hardConstraints,
  setScoreMin,
  setScoreMax,
  setObjectiveWeights,
  setHardConstraints,
}: UseOptimizerConfigParams) {
  const [isSavingOptimizerConfig, setIsSavingOptimizerConfig] = useState(false);
  const [optimizerSaveMessage, setOptimizerSaveMessage] = useState("");

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
        if (cfg.objective_weights && typeof cfg.objective_weights === "object") {
          setObjectiveWeights({ ...DEFAULT_OBJECTIVE_WEIGHTS, ...(cfg.objective_weights as Partial<ObjectiveWeights>) });
        }
        if (cfg.hard_constraints && typeof cfg.hard_constraints === "object") {
          setHardConstraints({ ...DEFAULT_HARD_CONSTRAINTS, ...(cfg.hard_constraints as Partial<HardConstraints>) });
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
          objective_weights: objectiveWeights,
          hard_constraints: hardConstraints,
        }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setOptimizerSaveMessage("保存しました");
    } catch {
      setOptimizerSaveMessage("保存に失敗しました");
    } finally {
      setIsSavingOptimizerConfig(false);
    }
  };

  return { isSavingOptimizerConfig, optimizerSaveMessage, saveOptimizerConfig };
}
