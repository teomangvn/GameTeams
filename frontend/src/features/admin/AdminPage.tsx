import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { adminApi, type AdminStats, type AdminUser } from "@/api/admin";
import { ApiError } from "@/api/client";
import { TextInput } from "@/features/auth/AuthLayout";
import { toast } from "@/stores/toastStore";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "short" });

export function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const loadUsers = (q: string) =>
    adminApi
      .users(q)
      .then((page) => setUsers(page.users))
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : "Kullanıcılar yüklenemedi."),
      );

  useEffect(() => {
    void Promise.all([adminApi.stats().then(setStats), loadUsers("")]).finally(() =>
      setLoading(false),
    );
  }, []);

  // Arama yazarken her tusa istek atmamak icin gecikme.
  useEffect(() => {
    const timer = setTimeout(() => void loadUsers(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const toggleUser = async (user: AdminUser) => {
    try {
      const updated = user.disabled
        ? await adminApi.enable(user.id)
        : await adminApi.disable(user.id, "Yönetici tarafından devre dışı bırakıldı");
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(
        updated.disabled ? `${updated.displayName} devre dışı.` : `${updated.displayName} aktif.`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "İşlem başarısız.");
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-lexend text-[13px] text-neutral-400 hover:text-neutral-200"
        >
          <ArrowLeft className="size-4" /> Uygulamaya dön
        </Link>

        <h1 className="font-lexend font-semibold text-[24px] text-neutral-50 mt-4">Yönetim</h1>

        {loading ? (
          <p className="font-lexend text-[14px] text-neutral-500 mt-6">Yükleniyor...</p>
        ) : (
          <>
            {stats && (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Kullanıcı" value={stats.totalUsers} />
                <StatCard label="Doğrulanmış" value={stats.verifiedUsers} />
                <StatCard label="Devre dışı" value={stats.disabledUsers} />
                <StatCard label="Oda" value={stats.totalRooms} />
                <StatCard label="Geçici oda" value={stats.temporaryRooms} />
                <StatCard label="Mesaj" value={stats.totalMessages} />
              </div>
            )}

            <div className="mt-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <h2 className="font-lexend font-semibold text-[16px] text-neutral-50 flex-1">
                  Kullanıcılar
                </h2>
                <div className="sm:w-64">
                  <TextInput
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Kullanıcı adı, ad veya e-posta"
                  />
                </div>
              </div>

              {users.length === 0 ? (
                <p className="font-lexend text-[14px] text-neutral-500 py-8 text-center">
                  Eşleşen kullanıcı yok.
                </p>
              ) : (
                <UserTable users={users} onToggle={toggleUser} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UserTable({
  users,
  onToggle,
}: {
  users: AdminUser[];
  onToggle: (user: AdminUser) => void;
}) {
  return (
    // Dar ekranda tablo kendi icinde kayar; sayfa yatay kaymaz.
    <div className="overflow-x-auto rounded-xl border border-neutral-800">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="bg-neutral-900/60">
            {["Kullanıcı", "E-posta", "Rol", "Durum", "Kayıt", ""].map((header) => (
              <th
                key={header}
                className="text-left font-lexend text-[12px] text-neutral-400 px-4 py-2.5"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t border-neutral-800">
              <td className="px-4 py-3">
                <div className="font-lexend text-[14px] text-neutral-100">{user.displayName}</div>
                <div className="font-lexend text-[12px] text-neutral-500">@{user.username}</div>
              </td>
              <td className="px-4 py-3 font-lexend text-[13px] text-neutral-400">{user.email}</td>
              <td className="px-4 py-3">
                <Badge tone={user.role === "ADMIN" ? "amber" : "neutral"}>{user.role}</Badge>
              </td>
              <td className="px-4 py-3">
                {user.disabled ? (
                  <Badge tone="red">Devre dışı</Badge>
                ) : user.emailVerified ? (
                  <Badge tone="emerald">Aktif</Badge>
                ) : (
                  <Badge tone="neutral">Doğrulanmamış</Badge>
                )}
              </td>
              <td className="px-4 py-3 font-lexend text-[13px] text-neutral-500">
                {dateFormatter.format(new Date(user.createdAt))}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onToggle(user)}
                  // Yonetici hesaplari kilitlenemez; aksi halde sistemi
                  // yonetecek kimse kalmayabilir.
                  disabled={user.role === "ADMIN"}
                  className={cn(
                    "font-lexend text-[13px] px-3 py-1.5 rounded-md transition-colors whitespace-nowrap",
                    "disabled:opacity-30 disabled:cursor-not-allowed",
                    user.disabled
                      ? "text-emerald-400 hover:bg-emerald-500/10"
                      : "text-red-400 hover:bg-red-500/10",
                  )}
                >
                  {user.disabled ? "Aktifleştir" : "Devre dışı bırak"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3">
      <div className="font-lexend text-[12px] text-neutral-500">{label}</div>
      <div className="font-lexend font-semibold text-[20px] text-neutral-50 mt-0.5">
        {value.toLocaleString("tr-TR")}
      </div>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "neutral" | "emerald" | "red" | "amber";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-neutral-800 text-neutral-300",
    emerald: "bg-emerald-500/15 text-emerald-400",
    red: "bg-red-500/15 text-red-400",
    amber: "bg-amber-500/15 text-amber-400",
  };
  return (
    <span className={cn("font-lexend text-[11px] px-2 py-1 rounded-md", tones[tone])}>
      {children}
    </span>
  );
}

export default AdminPage;
