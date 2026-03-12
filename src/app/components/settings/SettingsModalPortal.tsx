"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type SettingsModalPortalProps = {
  isOpen: boolean;
  children: ReactNode;
};

export default function SettingsModalPortal({ isOpen, children }: SettingsModalPortalProps) {
  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(children, document.body);
}