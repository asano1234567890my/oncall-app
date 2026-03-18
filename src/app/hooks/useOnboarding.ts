// src/app/hooks/useOnboarding.ts — オンボーディング状態管理
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthHeaders } from "./useAuth";

export type OnboardingSection = "rules" | "weights" | "doctors" | "generate" | "dnd";

const ALL_SECTIONS: OnboardingSection[] = ["rules", "weights", "doctors", "generate", "dnd"];

export function useOnboarding(isAuthenticated: boolean) {
  const [seenSections, setSeenSections] = useState<Set<OnboardingSection>>(new Set(ALL_SECTIONS));
  const [pendingSection, setPendingSection] = useState<OnboardingSection | null>(null);
  const loaded = useRef(false);

  // Load from DB
  useEffect(() => {
    if (!isAuthenticated || loaded.current) return;
    loaded.current = true;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${apiUrl}/api/settings/kv/onboarding_seen`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data: unknown) => {
        const value = (data as Record<string, unknown>)?.value;
        if (Array.isArray(value)) {
          setSeenSections(new Set(value as OnboardingSection[]));
        } else {
          setSeenSections(new Set());
        }
      })
      .catch(() => { /* keep all sections as "seen" on error */ });
  }, [isAuthenticated]);

  const markSeen = useCallback((section: OnboardingSection) => {
    setSeenSections((prev) => {
      const next = new Set(prev);
      next.add(section);
      // Save to DB
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      void fetch(`${apiUrl}/api/settings/kv/onboarding_seen`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ value: Array.from(next) }),
      });
      return next;
    });
    setPendingSection(null);
  }, []);

  const triggerOnboarding = useCallback((section: OnboardingSection) => {
    if (!seenSections.has(section)) {
      setPendingSection(section);
    }
  }, [seenSections]);

  const dismissOnboarding = useCallback(() => {
    if (pendingSection) {
      markSeen(pendingSection);
    }
  }, [pendingSection, markSeen]);

  const resetAll = useCallback(() => {
    setSeenSections(new Set());
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    void fetch(`${apiUrl}/api/settings/kv/onboarding_seen`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ value: [] }),
    });
  }, []);

  return {
    pendingSection,
    triggerOnboarding,
    dismissOnboarding,
    resetAll,
    hasSeen: (section: OnboardingSection) => seenSections.has(section),
  };
}
