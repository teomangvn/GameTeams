import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type React from "react";

import { useVoiceSession } from "@/features/voice/useVoiceSession";
import VoiceStage from "@/features/voice/VoiceStage";
import { useAuthStore } from "@/stores/authStore";

type VoiceSessionApi = ReturnType<typeof useVoiceSession>;

interface VoiceContextValue extends VoiceSessionApi {
  /**
   * Ses izgarasi mi sohbet mi gosterilecek. Bagli olmak ile izgarayi goruyor
   * olmak ayri durumlar: kullanici sese bagliyken metin kanalina veya baska
   * bir sayfaya gecip sonra izgaraya geri donebilmeli.
   */
  viewOpen: boolean;
  setViewOpen: (open: boolean) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

/**
 * Ses oturumunu route'larin ustunde yasatir.
 *
 * Onceden oturum AppShell icindeydi: profil veya ayarlar sayfasina gecmek
 * AppShell'i kaldiriyor, ses baglantisi da onunla birlikte olup izgaraya
 * donmenin bir yolu kalmiyordu. Uzak sesler de burada calinir, boylece baska
 * sayfadayken konusmalar duyulmaya devam eder.
 */
export function VoiceSessionProvider({ children }: { children: React.ReactNode }) {
  const voice = useVoiceSession();
  const [viewRequested, setViewOpen] = useState(false);
  const signedIn = useAuthStore((s) => Boolean(s.user));

  const { session, disconnect } = voice;
  // Baglanti yokken izgara acik sayilmaz; baglanti basarisiz olsa da bos ekran kalmaz.
  const viewOpen = viewRequested && session !== null;

  const disconnectAndClose = useCallback(() => {
    disconnect();
    setViewOpen(false);
  }, [disconnect]);

  // Cikis yapilinca oturum kapanmali; provider route'lardan bagimsiz yasiyor.
  // Izgara bayragi da sifirlanmali ki ayni sekmede giren kisi bos ekrana dusmesin.
  useEffect(() => {
    if (!signedIn && session) disconnectAndClose();
  }, [signedIn, session, disconnectAndClose]);

  return (
    <VoiceContext.Provider
      value={{ ...voice, disconnect: disconnectAndClose, viewOpen, setViewOpen }}
    >
      {children}
      {/* Uzak ses akislari; gorunur bir yeri yok ama olmadan ses duyulmaz. */}
      <VoiceStage session={session} />
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("useVoice VoiceSessionProvider icinde kullanilmali.");
  return value;
}

export default VoiceSessionProvider;
