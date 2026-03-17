"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { getAuthHeaders } from "../../hooks/useAuth";

type Doctor = {
  id: string;
  name: string;
  access_token?: string;
  is_locked?: boolean;
  is_active?: boolean;
};

type ApiResponseMessage = {
  message?: string;
  detail?: string;
};

const getApiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const readResponseMessage = async (response: Response, fallback: string) => {
  const text = await response.text();
  if (!text) return fallback;

  try {
    const payload = JSON.parse(text) as ApiResponseMessage;
    if (typeof payload.detail === "string" && payload.detail.trim()) return payload.detail;
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
  } catch {
    // ignore non-JSON responses
  }

  return fallback;
};

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

export default function DoctorManagerPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [bulkLockAction, setBulkLockAction] = useState<"lock" | "unlock" | null>(null);

  const activeDoctors = useMemo(() => doctors.filter((doctor) => doctor.is_active !== false), [doctors]);
  const archivedDoctors = useMemo(() => doctors.filter((doctor) => doctor.is_active === false), [doctors]);
  const isBulkLocking = bulkLockAction !== null;

  const fetchDoctors = async () => {
    const apiUrl = getApiBase();
    const response = await fetch(`${apiUrl}/api/doctors`, { headers: getAuthHeaders() });
    if (!response.ok) {
      throw new Error(await readResponseMessage(response, "Failed to fetch doctors"));
    }
    setDoctors(await response.json());
  };

  const applyActiveDoctorLockState = (isLocked: boolean) => {
    setDoctors((previous) =>
      previous.map((doctor) => (doctor.is_active === false ? doctor : { ...doctor, is_locked: isLocked }))
    );
  };

  useEffect(() => {
    void fetchDoctors().catch((error) => {
      console.error(error);
      toast.error("\u533b\u5e2b\u4e00\u89a7\u306e\u8aad\u307f\u8fbc\u307f\u306b\u5931\u6557\u3057\u307e\u3057\u305f");
    });
  }, []);

  const handleAdd = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    const apiUrl = getApiBase();
    const response = await fetch(`${apiUrl}/api/doctors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ name: trimmedName }),
    });

    if (!response.ok) {
      toast.error(await readResponseMessage(response, "\u533b\u5e2b\u306e\u8ffd\u52a0\u306b\u5931\u6557\u3057\u307e\u3057\u305f"));
      return;
    }

    setNewName("");
    await fetchDoctors();
  };

  const handleUpdate = async (doctorId: string) => {
    const trimmedName = editName.trim();
    if (!trimmedName) return;

    const apiUrl = getApiBase();
    const response = await fetch(`${apiUrl}/api/doctors/${doctorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ name: trimmedName }),
    });

    if (!response.ok) {
      toast.error(await readResponseMessage(response, "\u533b\u5e2b\u540d\u306e\u66f4\u65b0\u306b\u5931\u6557\u3057\u307e\u3057\u305f"));
      return;
    }

    setEditingId(null);
    setEditName("");
    await fetchDoctors();
  };

  const handleArchive = async (doctorId: string) => {
    if (!window.confirm("\u3053\u306e\u533b\u5e2b\u3092\u30a2\u30fc\u30ab\u30a4\u30d6\u3057\u3066\u4e00\u89a7\u304b\u3089\u975e\u8868\u793a\u306b\u3057\u307e\u3059\u304b\uff1f")) return;

    const apiUrl = getApiBase();
    const response = await fetch(`${apiUrl}/api/doctors/${doctorId}`, { method: "DELETE", headers: getAuthHeaders() });
    if (!response.ok) {
      toast.error(await readResponseMessage(response, "\u30a2\u30fc\u30ab\u30a4\u30d6\u306b\u5931\u6557\u3057\u307e\u3057\u305f"));
      return;
    }

    await fetchDoctors();
  };

  const handleRestore = async (doctor: Doctor) => {
    const apiUrl = getApiBase();
    setRestoringId(doctor.id);

    try {
      const response = await fetch(`${apiUrl}/api/doctors/${doctor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ is_active: true }),
      });

      if (!response.ok) {
        throw new Error(await readResponseMessage(response, "\u5fa9\u5143\u306b\u5931\u6557\u3057\u307e\u3057\u305f"));
      }

      await fetchDoctors();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "\u5fa9\u5143\u306b\u5931\u6557\u3057\u307e\u3057\u305f");
    } finally {
      setRestoringId(null);
    }
  };

  const copyEntryUrl = async (doctor: Doctor) => {
    if (!doctor.access_token) return;

    try {
      await copyText(`${window.location.origin}/entry/${doctor.access_token}`);
      setCopiedId(doctor.id);
      window.setTimeout(() => {
        setCopiedId((previous) => (previous === doctor.id ? null : previous));
      }, 1500);
    } catch (error) {
      console.error(error);
      toast.error("\u30b3\u30d4\u30fc\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u30d6\u30e9\u30a6\u30b6\u8a2d\u5b9a\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
    }
  };

  const toggleLock = async (doctor: Doctor) => {
    const apiUrl = getApiBase();
    setLockingId(doctor.id);

    try {
      const response = await fetch(`${apiUrl}/api/doctors/${doctor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ is_locked: !Boolean(doctor.is_locked) }),
      });

      if (!response.ok) {
        throw new Error(await readResponseMessage(response, "\u30ed\u30c3\u30af\u66f4\u65b0\u306b\u5931\u6557\u3057\u307e\u3057\u305f"));
      }

      await fetchDoctors();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "\u30ed\u30c3\u30af\u66f4\u65b0\u306b\u5931\u6557\u3057\u307e\u3057\u305f");
    } finally {
      setLockingId(null);
    }
  };

  const updateAllLocks = async (isLocked: boolean) => {
    const confirmed = window.confirm(
      isLocked
        ? "\u5168\u3066\u306e\u533b\u5e2b\u306e\u500b\u5225\u5165\u529b\u3092\u7981\u6b62\u3057\u307e\u3059\u304b\uff1f"
        : "\u5168\u3066\u306e\u533b\u5e2b\u306e\u500b\u5225\u5165\u529b\u3092\u8a31\u53ef\u3057\u307e\u3059\u304b\uff1f"
    );
    if (!confirmed) return;

    const apiUrl = getApiBase();
    const actionLabel = isLocked ? "\u30ed\u30c3\u30af" : "\u30ed\u30c3\u30af\u89e3\u9664";
    setBulkLockAction(isLocked ? "lock" : "unlock");

    try {
      const response = await fetch(`${apiUrl}/api/doctors/bulk-lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ is_locked: isLocked }),
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          await Promise.all(
            activeDoctors.map(async (doctor) => {
              const fallbackResponse = await fetch(`${apiUrl}/api/doctors/${doctor.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ is_locked: isLocked }),
              });

              if (!fallbackResponse.ok) {
                throw new Error(
                  await readResponseMessage(fallbackResponse, `\u5168\u533b\u5e2b\u306e${actionLabel}\u66f4\u65b0\u306b\u5931\u6557\u3057\u307e\u3057\u305f`)
                );
              }
            })
          );
        } else {
          throw new Error(await readResponseMessage(response, `\u5168\u533b\u5e2b\u306e${actionLabel}\u66f4\u65b0\u306b\u5931\u6557\u3057\u307e\u3057\u305f`));
        }
      }

      applyActiveDoctorLockState(isLocked);
      await fetchDoctors().catch((error) => {
        console.error(error);
      });
      toast.success(
        isLocked
          ? "\u5168\u533b\u5e2b\u3092\u30ed\u30c3\u30af\u3057\u307e\u3057\u305f"
          : "\u5168\u533b\u5e2b\u306e\u30ed\u30c3\u30af\u3092\u89e3\u9664\u3057\u307e\u3057\u305f"
      );
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : isLocked
            ? "\u5168\u533b\u5e2b\u306e\u30ed\u30c3\u30af\u66f4\u65b0\u306b\u5931\u6557\u3057\u307e\u3057\u305f"
            : "\u5168\u533b\u5e2b\u306e\u30ed\u30c3\u30af\u89e3\u9664\u306b\u5931\u6557\u3057\u307e\u3057\u305f"
      );
    } finally {
      setBulkLockAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-md sm:p-6">
        <h1 className="mb-6 border-b pb-2 text-xl font-bold text-gray-800 md:text-2xl">{"\u533b\u5e2b\u30de\u30b9\u30bf\u7ba1\u7406"}</h1>

        <div className="mb-8 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-3">
            <div className="mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder={"\u65b0\u3057\u3044\u533b\u5e2b\u540d\u3092\u5165\u529b"}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="w-full rounded border border-gray-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  void handleAdd();
                }}
                className="w-full whitespace-nowrap rounded bg-blue-600 px-4 py-3 font-bold text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto"
              >
                {"\u8ffd\u52a0"}
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => {
                  void updateAllLocks(true);
                }}
                disabled={isBulkLocking || activeDoctors.length === 0}
                className="w-full whitespace-nowrap rounded border border-amber-200 bg-amber-100 px-4 py-3 font-bold text-amber-900 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {bulkLockAction === "lock" ? "\u30ed\u30c3\u30af\u4e2d..." : "\u5168\u54e1\u30ed\u30c3\u30af"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void updateAllLocks(false);
                }}
                disabled={isBulkLocking || activeDoctors.length === 0}
                className="w-full whitespace-nowrap rounded border border-emerald-200 bg-emerald-100 px-4 py-3 font-bold text-emerald-800 transition-colors hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {bulkLockAction === "unlock" ? "\u89e3\u9664\u4e2d..." : "\u5168\u54e1\u89e3\u9664"}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="text-sm font-bold text-gray-700">{"\u73fe\u5728\u306e\u72b6\u614b"}</div>
          <span className="text-xs text-gray-500">
            {"\u8868\u793a\u4e2d: "}{activeDoctors.length}{"\u540d / \u30a2\u30fc\u30ab\u30a4\u30d6: "}{archivedDoctors.length}{"\u540d / \u5168\u4f53: "}{doctors.length}{"\u540d"}
          </span>
        </div>

        <div className="space-y-3">
          {activeDoctors.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              {"\u8868\u793a\u4e2d\u306e\u533b\u5e2b\u306f\u307e\u3060\u3044\u307e\u305b\u3093"}
            </div>
          ) : null}

          {activeDoctors.map((doctor) => {
            const locked = Boolean(doctor.is_locked);
            const isLocking = lockingId === doctor.id;

            return (
              <div
                key={doctor.id}
                className="flex flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 w-full">
                  {editingId === doctor.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate font-medium text-gray-700">{doctor.name}</div>
                      <span
                        className={[
                          "shrink-0 rounded border px-2 py-0.5 text-[11px] font-bold",
                          locked
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800",
                        ].join(" ")}
                      >
                        {locked ? "\u30ed\u30c3\u30af\u4e2d" : "\u5165\u529b\u53ef"}
                      </span>
                    </div>
                  )}

                  {doctor.access_token ? (
                    <div className="mt-1 truncate text-[11px] text-gray-400">/entry/{doctor.access_token}</div>
                  ) : (
                    <div className="mt-1 text-[11px] text-amber-600">
                      {"access_token \u304c\u672a\u751f\u6210\u3067\u3059\u3002backend \u518d\u751f\u6210\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002"}
                    </div>
                  )}
                </div>

                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      void toggleLock(doctor);
                    }}
                    disabled={isLocking || isBulkLocking}
                    className={[
                      "w-full whitespace-nowrap rounded border px-4 py-2 font-bold transition-colors disabled:opacity-50 sm:w-auto",
                      locked
                        ? "border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-200"
                        : "border-gray-200 bg-gray-100 text-gray-800 hover:bg-gray-200",
                    ].join(" ")}
                  >
                    {isLocking ? "\u66f4\u65b0\u4e2d..." : locked ? "\u30ed\u30c3\u30af\u89e3\u9664" : "\u30ed\u30c3\u30af\u3059\u308b"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void copyEntryUrl(doctor);
                    }}
                    disabled={!doctor.access_token}
                    className={[
                      "w-full whitespace-nowrap rounded border px-4 py-2 font-bold transition-colors sm:w-auto",
                      copiedId === doctor.id
                        ? "border-emerald-700 bg-emerald-600 text-white"
                        : !doctor.access_token
                          ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                          : "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
                    ].join(" ")}
                  >
                    {copiedId === doctor.id ? "\u30b3\u30d4\u30fc\u6e08\u307f" : "\u5165\u529b\u7528URL\u3092\u30b3\u30d4\u30fc"}
                  </button>

                  {editingId === doctor.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleUpdate(doctor.id);
                      }}
                      className="w-full whitespace-nowrap rounded bg-green-100 px-4 py-2 font-bold text-green-700 transition-colors hover:bg-green-200 sm:w-auto"
                    >
                      {"\u4fdd\u5b58"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(doctor.id);
                        setEditName(doctor.name);
                      }}
                      className="w-full whitespace-nowrap rounded bg-blue-100 px-4 py-2 font-bold text-blue-700 transition-colors hover:bg-blue-200 sm:w-auto"
                    >
                      {"\u540d\u524d\u3092\u7de8\u96c6"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      void handleArchive(doctor.id);
                    }}
                    title={"\u30a2\u30fc\u30ab\u30a4\u30d6\uff08\u975e\u8868\u793a\uff09"}
                    className="w-full whitespace-nowrap rounded bg-red-100 px-4 py-2 font-bold text-red-700 transition-colors hover:bg-red-200 sm:w-auto"
                  >
                    {"\u30a2\u30fc\u30ab\u30a4\u30d6"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <button
            type="button"
            onClick={() => setShowArchived((previous) => !previous)}
            className="flex w-full items-center justify-between gap-3 text-left text-sm font-bold text-gray-700"
          >
            <span>
              {showArchived ? "\u25bc" : "\u25b6"}
              {" \u30a2\u30fc\u30ab\u30a4\u30d6\u6e08\u307f\u306e\u533b\u5e2b\u3092\u8868\u793a\uff08\u9000\u8077\u8005\u306a\u3069\uff09"}
            </span>
            <span className="shrink-0 text-xs text-gray-500">{archivedDoctors.length}{"\u540d"}</span>
          </button>

          {showArchived ? (
            <div className="mt-3 space-y-3">
              {archivedDoctors.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-5 text-center text-sm text-gray-500">
                  {"\u30a2\u30fc\u30ab\u30a4\u30d6\u6e08\u307f\u306e\u533b\u5e2b\u306f\u3044\u307e\u305b\u3093"}
                </div>
              ) : (
                archivedDoctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate font-medium text-gray-700">{doctor.name}</div>
                        <span className="shrink-0 rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700">
                          {"\u30a2\u30fc\u30ab\u30a4\u30d6\u6e08\u307f"}
                        </span>
                      </div>
                      {doctor.access_token ? <div className="mt-1 truncate text-[11px] text-gray-400">/entry/{doctor.access_token}</div> : null}
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          void handleRestore(doctor);
                        }}
                        disabled={restoringId === doctor.id}
                        className="w-full rounded bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        {restoringId === doctor.id ? "\u5fa9\u5143\u4e2d..." : "\u5fa9\u5143"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}