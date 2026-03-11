"use client";

type ScheduleValidationAlertProps = {
  messages: string[];
  onDismiss: () => void;
  onForceSave: () => void;
};

export default function ScheduleValidationAlert({ messages, onDismiss, onForceSave }: ScheduleValidationAlertProps) {
  if (messages.length === 0) return null;

  return (
    <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
      <div className="font-bold">制約違反があります。修正してください。</div>
      <div className="mt-1 space-y-1">
        {messages.slice(0, 3).map((message, index) => (
          <div key={String(index) + message} className="whitespace-pre-line leading-snug">
            {message}
          </div>
        ))}
        {messages.length > 3 ? <div className="text-[9px] text-amber-700">ほか {messages.length - 3} 件</div> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={onForceSave}
          className="text-[10px] font-semibold text-gray-500 underline underline-offset-2 transition hover:text-gray-700"
        >
          違反を無視して確定する
        </button>
      </div>
    </div>
  );
}
