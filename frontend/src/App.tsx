import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import AdminPage from '@/features/admin/AdminPage'
import AppShell from '@/features/shell/AppShell'
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage'
import LoginPage from '@/features/auth/LoginPage'
import ConfirmEmailChangePage from '@/features/profile/ConfirmEmailChangePage'
import ProfilePage from '@/features/profile/ProfilePage'
import DeviceSettingsPage from '@/features/settings/DeviceSettingsPage'
import RegisterPage from '@/features/auth/RegisterPage'
import ResetPasswordPage from '@/features/auth/ResetPasswordPage'
import VerifyEmailPage from '@/features/auth/VerifyEmailPage'
import Toaster from '@/components/ui/toaster'
import AdminRoute from '@/routes/AdminRoute'
import ProtectedRoute from '@/routes/ProtectedRoute'
import { useAuthStore } from '@/stores/authStore'

// Sunucu verisi TanStack Query'de tutulur; WebSocket olaylari Phase 3'te
// bu cache'i setQueryData ile gunceller (yeniden fetch yerine).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

export default function App() {
  const restore = useAuthStore((s) => s.restore)

  // Sayfa açılışında refresh cookie'sinden oturumu kurtarmayı dene.
  useEffect(() => {
    void restore()
  }, [restore])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <DeviceSettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  )
}
