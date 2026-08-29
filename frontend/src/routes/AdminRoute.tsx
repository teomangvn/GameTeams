import type React from "react";
import { Navigate } from "react-router-dom";

import { useAuthStore } from "@/stores/authStore";

/** Yalnizca ADMIN rolu; digerleri ana sayfaya doner. */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  if (!initialized) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <span className="font-lexend text-[14px] text-neutral-500">Yükleniyor...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/" replace />;

  return <>{children}</>;
}

export default AdminRoute;
