import { useEffect, useRef, useState } from "react";
import { FaceSatisfied } from "@carbon/icons-react";

import { cn } from "@/lib/utils";

/**
 * Kompakt emoji seçici.
 *
 * Harici bir emoji kütüphanesi yerine sabit bir liste: tam Unicode seti
 * yüzlerce kilobayt ekliyor ve oyun sohbetinde kullanılan emoji sayısı
 * pratikte küçük. Liste büyürse ayrı bir pakete geçilebilir.
 */
const GROUPS: Array<{ title: string; emoji: string[] }> = [
  {
    title: "Sık kullanılan",
    emoji: ["😀", "😂", "🙂", "😉", "😎", "🥳", "😍", "🤔", "😐", "😴", "😭", "😡"],
  },
  {
    title: "Tepki",
    emoji: ["👍", "👎", "👌", "🙏", "👏", "🤝", "💪", "🔥", "✨", "💯", "❤️", "💔"],
  },
  {
    title: "Oyun",
    emoji: ["🎮", "🕹️", "🏆", "🥇", "⚔️", "🛡️", "🎯", "💀", "👾", "🚀", "⚡", "🧠"],
  },
  {
    title: "Durum",
    emoji: ["✅", "❌", "⚠️", "❓", "❗", "⏳", "📌", "🔇", "🔊", "🎧", "🎤", "📷"],
  },
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Emoji"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "size-8 rounded-md flex items-center justify-center transition-colors",
          open
            ? "bg-neutral-800 text-neutral-100"
            : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
        )}
      >
        <FaceSatisfied size={16} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Emoji seç"
          className="absolute bottom-full right-0 z-30 mb-2 w-72 max-h-72 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-xl shadow-black/60"
        >
          {GROUPS.map((group) => (
            <section key={group.title} className="mb-3 last:mb-0">
              <h3 className="font-lexend text-[11px] uppercase tracking-wide text-neutral-500 mb-1.5">
                {group.title}
              </h3>
              <div className="grid grid-cols-6 gap-1">
                {group.emoji.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    // Secim sonrasi kapatmiyoruz: arka arkaya birkac emoji
                    // eklemek yaygin ve her seferinde yeniden acmak yorucu.
                    onClick={() => onPick(emoji)}
                    className="size-9 rounded-md text-[20px] leading-none flex items-center justify-center hover:bg-neutral-800 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default EmojiPicker;
