import { Component, type ErrorInfo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Aurora on ayarinin renkleri; fallback varsayilani olarak kullanilir. */
const DEFAULT_COLORS: [string, string, string] = ["#0a001a", "#1a0b2e", "#f20089"];

interface BoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

/**
 * WebGL baglami calisma aninda kaybolabilir: surucu cokmesi, GPU reset veya
 * tarayicinin arka plandaki sekmeden baglami geri almasi. Arka plan suslemesi
 * yuzunden tum uygulama agaci patlamasin diye gradient bu sinirin arkasinda
 * render edilir; hata halinde statik CSS karsiligina duser.
 */
export class WebGLErrorBoundary extends Component<BoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Animasyonlu arka plan devre disi birakildi:", error, info.componentStack);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/**
 * WebGL2 yoksa (eski cihaz, GPU engel listesi) veya shader derlenemezse
 * gosterilen animasyonsuz karsilik: ayni renklerle kurulmus radyal gecisler.
 */
export function WebGLFallback({
  className,
  colors = DEFAULT_COLORS,
}: {
  className?: string;
  colors?: [string, string, string];
}) {
  const [base, mid, accent] = colors;
  return (
    <div
      aria-hidden="true"
      className={cn("absolute inset-0 overflow-hidden", className)}
      style={{
        backgroundColor: base,
        backgroundImage: [
          `radial-gradient(120% 90% at 15% 110%, ${accent}55 0%, transparent 55%)`,
          `radial-gradient(100% 80% at 85% 0%, ${mid} 0%, transparent 60%)`,
          `linear-gradient(160deg, ${base} 0%, ${mid} 100%)`,
        ].join(","),
      }}
    />
  );
}
