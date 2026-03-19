// src/app/components/SetupWizard.tsx — 初回セットアップウィザード
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getAuthHeaders } from "../hooks/useAuth";

type WizardProps = {
  onComplete: (options?: { openDoctorManage?: boolean; openUnavailable?: boolean }) => void;
  isRedo?: boolean;
};

type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type WizardState = {
  step: StepNumber;
  holidayShiftMode: "combined" | "split" | "";
  doctorCount: number;
  doctorNames: string[];
  minShifts: number;
  maxShifts: number;
  intervalDays: number;
  maxSaturdayNights: number;
};

const TOTAL_VISIBLE_STEPS = 7; // progress bar steps (excluding confirm)

// Step order: 人数→名前→形式→回数→間隔→土曜→不可日→確認

export default function SetupWizard({ onComplete, isRedo }: WizardProps) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    holidayShiftMode: "",
    doctorCount: 8,
    doctorNames: Array.from({ length: 8 }, (_, i) => `医師${i + 1}`),
    minShifts: 3,
    maxShifts: 5,
    intervalDays: 1,
    maxSaturdayNights: 2,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentDoctorCount, setCurrentDoctorCount] = useState<number | null>(null);
  const [existingDoctorNames, setExistingDoctorNames] = useState<string[]>([]);
  const [wantUnavailable, setWantUnavailable] = useState(false);

  const setStep = (step: StepNumber) => setState((s) => ({ ...s, step }));
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // やり直し時に現在の医師情報を取得
  useEffect(() => {
    if (!isRedo) return;
    fetch(`${apiUrl}/api/doctors/`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data: Array<{ name: string }>) => {
        setCurrentDoctorCount(data.length);
        setExistingDoctorNames(data.map((d) => d.name));
        setState((s) => ({
          ...s,
          doctorCount: data.length,
          doctorNames: data.map((d) => d.name),
        }));
      })
      .catch(() => {/* ignore */});
  }, [isRedo, apiUrl]);

  // 医師数変更時に名前配列を同期
  const syncDoctorNames = (newCount: number) => {
    setState((s) => {
      const names = [...s.doctorNames];
      if (newCount > names.length) {
        for (let i = names.length; i < newCount; i++) {
          names.push(`医師${i + 1}`);
        }
      } else if (newCount < names.length) {
        names.length = newCount;
      }
      return { ...s, doctorCount: newCount, doctorNames: names };
    });
  };

  const handleFinish = async (openUnavailable: boolean) => {
    setIsSaving(true);
    setError("");
    try {
      // 1. Handle doctors
      if (isRedo && currentDoctorCount !== null) {
        const diff = state.doctorCount - currentDoctorCount;
        if (diff > 0) {
          const doctorPromises = Array.from({ length: diff }, (_, i) =>
            fetch(`${apiUrl}/api/doctors/`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...getAuthHeaders() },
              body: JSON.stringify({ name: state.doctorNames[currentDoctorCount + i] || `医師${currentDoctorCount + i + 1}`, is_active: true }),
            })
          );
          await Promise.all(doctorPromises);
        }
      } else if (!isRedo) {
        // 初回: 全員作成（カスタム名で）
        const doctorPromises = state.doctorNames.map((name) =>
          fetch(`${apiUrl}/api/doctors/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ name, is_active: true }),
          })
        );
        await Promise.all(doctorPromises);
      }

      // 2. Save optimizer config
      const optimizerConfig = {
        score_min: state.minShifts,
        score_max: state.maxShifts,
        objective_weights: {},
        hard_constraints: {
          interval_days: state.intervalDays,
          max_saturday_nights: state.maxSaturdayNights,
          holiday_shift_mode: state.holidayShiftMode || "combined",
        },
      };
      await fetch(`${apiUrl}/api/settings/optimizer_config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(optimizerConfig),
      });

      // 3. Mark setup as completed
      await fetch(`${apiUrl}/api/settings/kv/setup_completed`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ value: true }),
      });

      const needsDoctorManage = isRedo && currentDoctorCount !== null && state.doctorCount < currentDoctorCount;
      onComplete({
        openDoctorManage: needsDoctorManage,
        openUnavailable: openUnavailable,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "設定の保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  // やり直し時の医師数差分メッセージ
  const doctorDiffMessage = isRedo && currentDoctorCount !== null
    ? state.doctorCount > currentDoctorCount
      ? `${state.doctorCount - currentDoctorCount}名の仮医師を追加します`
      : state.doctorCount < currentDoctorCount
        ? `現在${currentDoctorCount}名登録済みです。完了後に医師管理画面で${currentDoctorCount - state.doctorCount}名をアーカイブしてください`
        : "現在の人数と同じです"
    : null;

  return (
    <div className="mx-auto max-w-lg py-8 px-4">
      {/* Progress */}
      <div className="mb-8 flex items-center justify-center gap-1.5">
        {Array.from({ length: TOTAL_VISIBLE_STEPS }, (_, i) => i + 1).map((s) => (
          <div
            key={s}
            className={`h-2 w-8 rounded-full transition-colors ${
              s <= state.step ? "bg-blue-600" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* Step 1: 医師人数 */}
      {state.step === 1 && (
        <StepContainer
          title="何人で当直を回していますか？"
          subtitle={isRedo ? `現在${currentDoctorCount ?? "?"}名が登録されています` : "あとから医師の追加・削除もできます"}
        >
          <div className="flex items-center justify-center gap-4 my-6">
            <button
              onClick={() => syncDoctorNames(Math.max(2, state.doctorCount - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-lg font-bold text-gray-600 hover:bg-gray-100"
            >
              −
            </button>
            <span className="text-4xl font-bold text-gray-800 w-16 text-center">{state.doctorCount}</span>
            <button
              onClick={() => syncDoctorNames(Math.min(30, state.doctorCount + 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-lg font-bold text-gray-600 hover:bg-gray-100"
            >
              +
            </button>
          </div>
          <p className="text-center text-sm text-gray-500 mb-2">{state.doctorCount}名</p>
          {doctorDiffMessage && (
            <p className={`text-center text-sm mb-4 ${state.doctorCount < (currentDoctorCount ?? 0) ? "text-amber-600" : "text-blue-600"}`}>
              {doctorDiffMessage}
            </p>
          )}
          <button
            onClick={() => setStep(2)}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
          >
            次へ
          </button>
        </StepContainer>
      )}

      {/* Step 2: 医師の名前 */}
      {state.step === 2 && (
        <StepContainer
          title="医師の名前を入力してください"
          subtitle="そのままでもひとまず作成できます。後から変更も可能です。"
        >
          <div className="my-4 max-h-64 overflow-y-auto space-y-2 px-1">
            {state.doctorNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-8 text-right text-sm text-gray-400 shrink-0">{i + 1}.</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const names = [...state.doctorNames];
                    names[i] = e.target.value;
                    setState((s) => ({ ...s, doctorNames: names }));
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={`医師${i + 1}`}
                />
              </div>
            ))}
          </div>
          <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </StepContainer>
      )}

      {/* Step 3: 当直形式 */}
      {state.step === 3 && (
        <StepContainer
          title="当直の形式を教えてください"
          subtitle="日曜・祝日の日直と、夜間の当直の担当者は？"
        >
          <div className="space-y-3">
            <ChoiceButton
              label="同じ人が両方担当"
              description="日直と当直は同じ医師が担当します"
              selected={state.holidayShiftMode === "combined"}
              onClick={() => setState((s) => ({ ...s, holidayShiftMode: "combined" }))}
            />
            <ChoiceButton
              label="別々の人が担当"
              description="日直と当直は異なる医師が担当します"
              selected={state.holidayShiftMode === "split"}
              onClick={() => setState((s) => ({ ...s, holidayShiftMode: "split" }))}
            />
          </div>
          <button
            onClick={() => setStep(4)}
            className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-white font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={!state.holidayShiftMode}
          >
            次へ
          </button>
          <button onClick={() => setStep(2)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 mt-1">
            戻る
          </button>
        </StepContainer>
      )}

      {/* Step 4: 回数 */}
      {state.step === 4 && (
        <StepContainer
          title="1ヶ月に1人あたり何回くらい当直しますか？"
          subtitle="最低回数と最大回数を設定してください"
        >
          <div className="space-y-4 my-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">最低回数</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={state.minShifts}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setState((s) => ({ ...s, minShifts: v, maxShifts: Math.max(v, s.maxShifts) }));
                  }}
                  className="flex-1"
                />
                <span className="w-12 text-right text-lg font-bold text-gray-800">{state.minShifts}回</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">最大回数</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={15}
                  step={1}
                  value={state.maxShifts}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setState((s) => ({ ...s, maxShifts: v, minShifts: Math.min(v, s.minShifts) }));
                  }}
                  className="flex-1"
                />
                <span className="w-12 text-right text-lg font-bold text-gray-800">{state.maxShifts}回</span>
              </div>
            </div>
          </div>
          <NavButtons onBack={() => setStep(3)} onNext={() => setStep(5)} />
        </StepContainer>
      )}

      {/* Step 5: 間隔 */}
      {state.step === 5 && (
        <StepContainer
          title="当直明けは何日空けたいですか？"
          subtitle="連続を避けるために最低限空ける日数です"
        >
          <div className="my-6">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={7}
                value={state.intervalDays}
                onChange={(e) => setState((s) => ({ ...s, intervalDays: Number(e.target.value) }))}
                className="flex-1"
              />
              <span className="w-16 text-right text-lg font-bold text-gray-800">
                {state.intervalDays === 0 ? "翌日OK" : `${state.intervalDays}日`}
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5 px-0.5">
              <span>翌日OK</span>
              <span>7日</span>
            </div>
          </div>
          <NavButtons onBack={() => setStep(4)} onNext={() => setStep(6)} />
        </StepContainer>
      )}

      {/* Step 6: 土曜上限 */}
      {state.step === 6 && (
        <StepContainer
          title="土曜の夜間当直は月何回まで？"
          subtitle="土曜の当直を制限できます"
        >
          <div className="grid grid-cols-3 gap-3 my-6">
            {[
              { value: 99, label: "制限なし" },
              { value: 1, label: "1回" },
              { value: 2, label: "2回" },
            ].map(({ value, label }) => (
              <ChoiceButton
                key={value}
                label={label}
                selected={state.maxSaturdayNights === value}
                onClick={() => setState((s) => ({ ...s, maxSaturdayNights: value }))}
              />
            ))}
          </div>
          <NavButtons onBack={() => setStep(5)} onNext={() => setStep(7)} />
        </StepContainer>
      )}

      {/* Step 7: 不可日設定 */}
      {state.step === 7 && (
        <StepContainer
          title="休み希望はありますか？"
          subtitle="医師ごとに当直に入れない日を設定できます"
        >
          <div className="space-y-3 my-6">
            <ChoiceButton
              label="今は設定しない"
              description="まずはシフトを生成してみましょう。後からいつでも設定できます。"
              selected={!wantUnavailable}
              onClick={() => setWantUnavailable(false)}
            />
            <ChoiceButton
              label="先に設定する"
              description="完了後に不可日の設定画面が開きます。"
              selected={wantUnavailable}
              onClick={() => setWantUnavailable(true)}
            />
          </div>
          <NavButtons onBack={() => setStep(6)} onNext={() => setStep(8)} />
        </StepContainer>
      )}

      {/* Step 8: 確認 */}
      {state.step === 8 && (
        <StepContainer
          title="設定完了！"
          subtitle="この設定はあとからいつでも変更できます"
        >
          <div className="my-6 rounded-xl bg-blue-50 p-4 text-sm text-gray-700 space-y-1 text-left">
            <p>医師：{state.doctorNames.join("、")}</p>
            <p>当直形式：{state.holidayShiftMode === "combined" ? "日直・当直 同一" : "日直・当直 別"}</p>
            <p>月あたり：{state.minShifts}〜{state.maxShifts}回</p>
            <p>当直間隔：{state.intervalDays === 0 ? "翌日OK" : `${state.intervalDays}日`}</p>
            <p>土曜上限：{state.maxSaturdayNights >= 99 ? "制限なし" : `${state.maxSaturdayNights}回`}</p>
            <p>休み希望：{wantUnavailable ? "設定する" : "あとで"}</p>
          </div>

          {isRedo && currentDoctorCount !== null && state.doctorCount < currentDoctorCount && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
              完了後に医師管理画面が開きます。不要な医師を削除してください。
            </p>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

          <button
            onClick={() => { void handleFinish(wantUnavailable); }}
            disabled={isSaving}
            className="w-full rounded-xl bg-blue-600 py-4 text-base font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                設定を保存中...
              </span>
            ) : (
              "この設定で始める"
            )}
          </button>
          <button onClick={() => setStep(7)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 mt-2">
            戻る
          </button>
        </StepContainer>
      )}
    </div>
  );
}

/* ── サブコンポーネント ── */

function StepContainer({ title, subtitle, children }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
      <p className="text-sm text-gray-500 mb-6">{subtitle}</p>
      {children}
    </div>
  );
}

function ChoiceButton({ label, description, selected, onClick }: {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border-2 px-4 py-4 text-left transition-colors ${
        selected
          ? "border-blue-600 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50/30"
      }`}
    >
      <div className="text-base font-bold">{label}</div>
      {description && <div className="text-sm text-gray-500 mt-0.5">{description}</div>}
    </button>
  );
}

function NavButtons({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onBack}
        className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
      >
        戻る
      </button>
      <button
        onClick={onNext}
        className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
      >
        次へ
      </button>
    </div>
  );
}
