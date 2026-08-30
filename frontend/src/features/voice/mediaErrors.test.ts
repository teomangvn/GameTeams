import { afterEach, describe, expect, it, vi } from "vitest";

import {
  describeMicrophoneError,
  describeScreenShareError,
  isSecureMediaContext,
} from "@/features/voice/mediaErrors";

/** Tarayici hatalari yalnizca name alanina gore ayirt edilir. */
function domError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

function setMediaDevices(value: unknown) {
  vi.stubGlobal("navigator", { mediaDevices: value });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isSecureMediaContext", () => {
  it("https/localhost gibi guvenli baglamda true doner", () => {
    setMediaDevices({});
    expect(isSecureMediaContext()).toBe(true);
  });

  it("duz http'de mediaDevices tanimsizdir", () => {
    setMediaDevices(undefined);
    expect(isSecureMediaContext()).toBe(false);
  });
});

describe("describeMicrophoneError", () => {
  /**
   * Asil duzeltme: HTTP uzerinde tarayici izin sormaz, dolayisiyla
   * "izinleri kontrol et" demek kullaniciyi bos yere ugrastirir.
   */
  it("guvensiz baglamda izin degil HTTPS mesaji verir", () => {
    setMediaDevices(undefined);

    const message = describeMicrophoneError(domError("NotAllowedError"));

    expect(message).toContain("HTTPS");
    expect(message).not.toContain("izin verebilirsin");
  });

  it("izin reddedildiginde nereden acilacagini soyler", () => {
    setMediaDevices({});
    expect(describeMicrophoneError(domError("NotAllowedError"))).toContain("izni reddedildi");
  });

  it("aygit yoksa mikrofon aramaya yonlendirir", () => {
    setMediaDevices({});
    expect(describeMicrophoneError(domError("NotFoundError"))).toContain("bulunamadı");
  });

  it("aygit mesgulse baska uygulamayi isaret eder", () => {
    setMediaDevices({});
    expect(describeMicrophoneError(domError("NotReadableError"))).toContain("başka bir uygulama");
  });

  it("bilinmeyen hatada genel mesaja duser", () => {
    setMediaDevices({});
    expect(describeMicrophoneError(new Error("bilinmeyen"))).toBe("Mikrofona erişilemedi.");
  });
});

describe("describeScreenShareError", () => {
  /** Paylasim penceresini kapatmak hata degildir; uyari gosterilmemeli. */
  it("kullanici iptal ettiginde mesaj uretmez", () => {
    setMediaDevices({});
    expect(describeScreenShareError(domError("NotAllowedError"))).toBeNull();
    expect(describeScreenShareError(domError("AbortError"))).toBeNull();
  });

  it("guvensiz baglamda HTTPS uyarisi verir", () => {
    setMediaDevices(undefined);
    expect(describeScreenShareError(domError("AbortError"))).toContain("HTTPS");
  });

  it("gercek hatada mesaj doner", () => {
    setMediaDevices({});
    expect(describeScreenShareError(domError("NotReadableError"))).toContain("başlatılamadı");
  });
});
