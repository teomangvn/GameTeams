import type { MatchResult } from "@/api/matchmaking";

/**
 * Eslesme bulundugunda cikan modal. Kullanici odaya gecmeden once kiminle
 * eslestigini gorur.
 */
export function MatchFoundDialog({
  match,
  onJoin,
  onDismiss,
}: {
  match: MatchResult | null;
  onJoin: (match: MatchResult) => void;
  onDismiss: () => void;
}) {
  if (!match) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-black border border-emerald-500/40 rounded-2xl p-6">
        <div className="text-center">
          <div className="font-lexend text-[12px] uppercase tracking-wide text-emerald-400">
            Eşleşme bulundu
          </div>
          <h2 className="font-lexend font-semibold text-[22px] text-neutral-50 mt-1">
            {match.gameName}
          </h2>
          <p className="font-lexend text-[13px] text-neutral-400 mt-1">
            {match.partySize} kişilik takım hazır
          </p>
        </div>

        <ul className="mt-6 flex flex-col gap-2">
          {match.participants.map((p) => (
            <li
              key={p.userId}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-900"
            >
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt={p.displayName} className="size-8 rounded-full object-cover" />
              ) : (
                <span className="size-8 rounded-full bg-neutral-800 flex items-center justify-center font-lexend text-[12px] text-neutral-300">
                  {p.displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="font-lexend text-[14px] text-neutral-100">{p.displayName}</span>
              <span className="ml-auto font-lexend text-[12px] text-neutral-500">
                @{p.username}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 h-10 rounded-lg border border-neutral-800 font-lexend text-[14px] text-neutral-300 hover:bg-neutral-900"
          >
            Sonra
          </button>
          <button
            type="button"
            onClick={() => onJoin(match)}
            className="flex-1 h-10 rounded-lg bg-emerald-500 font-lexend font-semibold text-[14px] text-neutral-950 hover:bg-emerald-400"
          >
            Takıma katıl
          </button>
        </div>
      </div>
    </div>
  );
}

export default MatchFoundDialog;
