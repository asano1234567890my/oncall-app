"use client";

import { useEffect, useState } from "react";

const clampNumber = (value: number, min?: number, max?: number) => {
  let next = value;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
};

const getStepPrecision = (step: number) => {
  const stepText = String(step);
  const decimal = stepText.includes(".") ? stepText.split(".")[1]?.length ?? 0 : 0;
  return decimal;
};

const formatStepValue = (value: number, step: number) => {
  const precision = getStepPrecision(step);
  return Number(value.toFixed(precision)).toString();
};

type BaseProps = {
  fallbackValue: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
};

type NonNullableProps = BaseProps & {
  value: number;
  onCommit: (value: number) => void;
  nullPlaceholder?: undefined;
};

type NullableProps = BaseProps & {
  value: number | null;
  onCommit: (value: number | null) => void;
  nullPlaceholder: string;
};

type StepperNumberInputProps = NonNullableProps | NullableProps;

export default function StepperNumberInput(props: StepperNumberInputProps) {
  const {
    value,
    onCommit,
    fallbackValue,
    min,
    max,
    step = 1,
    disabled = false,
    placeholder,
    inputMode,
    className = "",
    inputClassName = "",
    buttonClassName = "",
  } = props;
  const nullPlaceholder = "nullPlaceholder" in props ? props.nullPlaceholder : undefined;

  const [draft, setDraft] = useState(() =>
    value === null && nullPlaceholder ? nullPlaceholder : formatStepValue(value ?? fallbackValue, step),
  );

  useEffect(() => {
    setDraft(
      value === null && nullPlaceholder ? nullPlaceholder : formatStepValue(value ?? fallbackValue, step),
    );
  }, [step, value, nullPlaceholder, fallbackValue]);

  const commitDraft = (raw: string) => {
    const trimmed = raw.trim();
    if (nullPlaceholder && (trimmed === "" || trimmed === nullPlaceholder)) {
      setDraft(nullPlaceholder);
      (onCommit as (v: number | null) => void)(null);
      return;
    }
    const parsed = trimmed === "" ? fallbackValue : Number(trimmed);
    const nextValue = clampNumber(Number.isFinite(parsed) ? parsed : fallbackValue, min, max);
    const nextText = formatStepValue(nextValue, step);
    setDraft(nextText);
    onCommit(nextValue as never);
  };

  const handleStep = (direction: -1 | 1) => {
    const base = value ?? 0;
    const nextRaw = base + direction * step;
    if (nullPlaceholder && nextRaw <= 0) {
      setDraft(nullPlaceholder);
      (onCommit as (v: number | null) => void)(null);
      return;
    }
    const nextValue = clampNumber(nextRaw, min, max);
    const nextText = formatStepValue(nextValue, step);
    setDraft(nextText);
    onCommit(nextValue as never);
  };

  return (
    <div className={["flex w-full min-w-0 items-center gap-1", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        onClick={() => handleStep(-1)}
        disabled={disabled}
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-bold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40",
          buttonClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        -
      </button>
      <input
        type="text"
        inputMode={inputMode ?? (step % 1 === 0 ? "numeric" : "decimal")}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commitDraft(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitDraft(draft);
          }
        }}
        disabled={disabled}
        placeholder={placeholder}
        className={[
          "w-full min-w-[2rem] flex-1 rounded-lg border border-gray-200 bg-white px-2 py-2 text-center text-sm font-semibold tabular-nums text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100",
          inputClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <button
        type="button"
        onClick={() => handleStep(1)}
        disabled={disabled}
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-bold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40",
          buttonClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        +
      </button>
    </div>
  );
}
