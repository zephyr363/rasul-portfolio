import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Центрированный контейнер шириной как в mockup-v2 (1200px, паддинг 32px). */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-8", className)}>{children}</div>;
}
