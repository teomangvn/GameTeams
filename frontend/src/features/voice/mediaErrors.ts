/**
 * Mikrofon/ekran erisim hatalarini kullanicinin ne yapacagini bilecegi
 * mesajlara cevirir.
 *
 * Hepsine "izinleri kontrol et" demek yaniltici: en sik karsilasilan durum
 * sayfanin HTTPS olmamasi ve orada izin diye bir sey sorulmuyor bile.
 */

/**
 * Tarayici mikrofon ve ekran paylasimini yalnizca guvenli baglamda acar:
 * https:// veya localhost. Duz http:// uzerinde navigator.mediaDevices
 * tanimsizdir, dolayisiyla izin istemek mumkun degildir.
 */
export function isSecureMediaContext(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices);
}

export function describeMicrophoneError(error: unknown): string {
  if (!isSecureMediaContext()) {
    return "Ses kanalları HTTPS gerektiriyor. Tarayıcı, güvenli olmayan bağlantıda mikrofona izin vermiyor.";
  }

  const name = error instanceof Error ? error.name : "";

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Mikrofon izni reddedildi. Adres çubuğundaki kilit simgesinden izin verebilirsin.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Mikrofon bulunamadı. Bir giriş aygıtı bağlı mı kontrol et.";
    case "NotReadableError":
    case "TrackStartError":
      return "Mikrofona erişilemedi; başka bir uygulama kullanıyor olabilir.";
    case "OverconstrainedError":
      return "Seçili mikrofon istenen ayarları desteklemiyor.";
    default:
      return "Mikrofona erişilemedi.";
  }
}

export function describeScreenShareError(error: unknown): string | null {
  if (!isSecureMediaContext()) {
    return "Ekran paylaşımı HTTPS gerektiriyor.";
  }

  const name = error instanceof Error ? error.name : "";

  // Kullanici paylasim penceresini kapattiysa bu bir hata degil; sessizce gec.
  if (name === "NotAllowedError" || name === "AbortError") {
    return null;
  }
  return "Ekran paylaşımı başlatılamadı.";
}
