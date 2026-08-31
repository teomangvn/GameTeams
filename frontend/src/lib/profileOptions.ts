/**
 * Profil ve eslestirme icin ortak bolge/dil listeleri.
 *
 * Eslestirme kuyrugu oyunculari bolge ve dile gore gruplandiriyor; serbest
 * metin girildiginde "EU" ile "eu" ayri grup sayilir ve kimse eslesemez.
 * Sabit listeyle bu tamamen ortadan kalkiyor.
 */

export interface Option {
  value: string;
  label: string;
}

export const REGIONS: Option[] = [
  { value: "TR", label: "Türkiye" },
  { value: "EU", label: "Avrupa" },
  { value: "NA", label: "Kuzey Amerika" },
  { value: "SA", label: "Güney Amerika" },
  { value: "ME", label: "Orta Doğu" },
  { value: "ASIA", label: "Asya" },
  { value: "OCE", label: "Okyanusya" },
  { value: "AF", label: "Afrika" },
];

export const LANGUAGES: Option[] = [
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "İngilizce" },
  { value: "de", label: "Almanca" },
  { value: "fr", label: "Fransızca" },
  { value: "es", label: "İspanyolca" },
  { value: "it", label: "İtalyanca" },
  { value: "pt", label: "Portekizce" },
  { value: "ru", label: "Rusça" },
  { value: "ar", label: "Arapça" },
];

/**
 * Listede olmayan bir deger (serbest metin doneminden kalma) sessizce
 * kaybolmasin: mevcut secim olarak eklenir.
 */
export function withCurrent(options: Option[], current: string): Option[] {
  if (!current || options.some((option) => option.value === current)) return options;
  return [...options, { value: current, label: current }];
}
