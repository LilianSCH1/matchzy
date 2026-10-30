/** Rang de l'équipe, avec le liseré vert des qualifiés. `move` ajoute la flèche de l'écran géant. */
export function RankCell({ rank, qualified, big, move }: { rank: number; qualified: boolean; big: boolean; move?: "up" | "down" }) {
  return (
    <td className={`relative pl-4 ${big ? "py-2.5" : "py-2"}`}>
      {qualified && <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-ok" aria-hidden />}
      <span
        className={`inline-flex items-center justify-center rounded-[4px] font-bold tabular-nums ${big ? "size-8 text-lg" : "size-6 text-sm"} ${
          qualified ? "bg-ok text-on-ok" : "text-ink-3"
        }`}
      >
        {rank}
      </span>
      {move && (
        <span className={`ml-1 inline-block align-middle text-sm leading-none ${move === "up" ? "text-ok" : "text-live"}`} aria-label={move === "up" ? "monte" : "descend"}>
          {move === "up" ? "▲" : "▼"}
        </span>
      )}
    </td>
  );
}
