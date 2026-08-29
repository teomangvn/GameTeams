import type React from "react";
import { Gamepad2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Kimlik ekranlarının ortak çerçevesi. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Gamepad2 className="size-7 text-neutral-50" strokeWidth={2} />
          <span className="font-lexend font-semibold text-[20px] text-neutral-50">
            GameTeams
          </span>
        </div>

        <div className="bg-black border border-neutral-800 rounded-2xl p-8">
          <h1 className="font-lexend font-semibold text-[22px] text-neutral-50">{title}</h1>
          {subtitle && (
            <p className="font-lexend text-[14px] text-neutral-400 mt-2 leading-relaxed">
              {subtitle}
            </p>
          )}
          <div className="mt-6">{children}</div>
        </div>

        {footer && (
          <div className="mt-6 text-center font-lexend text-[14px] text-neutral-400">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-lexend text-[13px] text-neutral-300 mb-1.5">{label}</span>
      {children}
      {error && (
        <span className="block font-lexend text-[12px] text-red-400 mt-1.5">{error}</span>
      )}
    </label>
  );
}

export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full h-10 rounded-lg bg-neutral-950 border border-neutral-800 px-3",
        "font-lexend text-[14px] text-neutral-50 placeholder:text-neutral-600",
        "outline-none focus:border-neutral-600 transition-colors",
        className,
      )}
    />
  );
}

export function SubmitButton({
  loading,
  children,
}: {
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        "w-full h-10 rounded-lg bg-neutral-50 text-neutral-950",
        "font-lexend font-semibold text-[14px]",
        "hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
      )}
    >
      {loading ? "Lütfen bekle..." : children}
    </button>
  );
}

export function FormAlert({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border px-3 py-2.5 font-lexend text-[13px] leading-relaxed",
        tone === "error"
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      )}
    >
      {children}
    </div>
  );
}
