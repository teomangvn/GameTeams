import type React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuthStore } from "@/stores/authStore";

/** Oturum yoksa girişe yönlendirir; geldiği adresi state'te taşır. */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const location = useLocation();

  // Oturum geri yükleme bitmeden yönlendirme yapılırsa, sayfa yenilendiğinde
  // giriş yapmış kullanıcı da bir an login ekranına atılır.
  if (!initialized) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <span className="font-lexend text-[14px] text-neutral-500">Yükleniyor...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
