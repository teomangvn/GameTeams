import { memo } from "react";

import AnimatedGradient, {
  type GradientConfig,
  type NoiseConfig,
} from "@/components/ui/animated-gradient";

/*
 * Ayarlar modul seviyesinde sabit: AnimatedGradient icindeki useMemo config
 * kimligine bagli ve o memo da WebGL efektinin bagimliligi. Satir ici nesne
 * verilseydi her render yeni kimlik uretir, shader programi her seferinde
 * yeniden derlenirdi.
 */
const CONFIG: GradientConfig = {
  preset: "Aurora",
  // On ayar 15; surekli acik duran bir arka plan icin daha sakin bir tempo.
  speed: 8,
};

const NOISE: NoiseConfig = { opacity: 0.4 };

/**
 * Uygulama kabugunun etrafindaki cerceve boslugunu dolduran animasyonlu
 * gradient. Icerik opak olduğu icin yalnizca kenar payinda gorunur.
 */
export const AppBackground = memo(function AppBackground() {
  return <AnimatedGradient config={CONFIG} noise={NOISE} />;
});

export default AppBackground;
