"use client";

import type { ReactNode } from "react";

export function Slide({ children }: { children: ReactNode }) {
  return <section className="slide">{children}</section>;
}

