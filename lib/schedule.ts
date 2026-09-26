// Planification : attribution d'un créneau et d'un terrain à chaque match.

export interface ScheduleOptions {
  courts: number;
  matchDuration: number; // minutes
  breakDuration: number; // minutes entre deux matchs sur un même terrain
  minRest: number; // repos minimum d'une équipe entre la fin d'un match et le début du suivant
}

export interface SchedMatch {
  id: string;
  /** Identifiants des équipes (ou clés de substitution pour la phase finale). */
  teams: string[];
  /** Étape : 0 = poules, puis un numéro croissant par tour de phase finale. */
  stage: number;
  /** Ordre de priorité à l'intérieur d'une étape (ronde de Berger, etc.). */
  order: number;
}

export interface Slotted {
  id: string;
  slot: number;
  court: number;
}

export function slotLength(o: Pick<ScheduleOptions, "matchDuration" | "breakDuration">): number {
  return o.matchDuration + o.breakDuration;
}

/** Nombre minimal de créneaux entre deux matchs d'une même équipe. */
export function restGap(o: ScheduleOptions): number {
  const L = slotLength(o);
  return Math.max(1, Math.ceil((o.matchDuration + o.minRest) / L));
}

export function schedule(matches: SchedMatch[], o: ScheduleOptions): Slotted[] {
  const courts = Math.max(1, o.courts);
  const gap = restGap(o);
  const stages = [...new Set(matches.map((m) => m.stage))].sort((a, b) => a - b);
  const lastSlot = new Map<string, number>();
  const usage = new Map<string, number[]>();
  const res: Slotted[] = [];
  let slot = 0;
  let lastUsed = -1;

  for (const stage of stages) {
    const pending = matches.filter((m) => m.stage === stage).sort((a, b) => a.order - b.order);
    if (stage !== stages[0] && lastUsed >= 0) slot = lastUsed + gap;
    let guard = 0;
    while (pending.length > 0) {
      const picked: SchedMatch[] = [];
      for (let i = 0; i < pending.length && picked.length < courts; i++) {
        const m = pending[i];
        const ok = m.teams.every((t) => {
          const l = lastSlot.get(t);
          return l === undefined || slot - l >= gap;
        });
        if (!ok) continue;
        picked.push(m);
        m.teams.forEach((t) => lastSlot.set(t, slot));
        pending.splice(i, 1);
        i--;
      }
      // Attribution des terrains : on équilibre l'utilisation de chaque terrain par équipe.
      const free = Array.from({ length: courts }, (_, c) => c);
      for (const m of picked) {
        let bestCourt = free[0];
        let bestCost = Infinity;
        for (const c of free) {
          const cost = m.teams.reduce((s, t) => s + (usage.get(t)?.[c] ?? 0), 0);
          if (cost < bestCost) {
            bestCost = cost;
            bestCourt = c;
          }
        }
        free.splice(free.indexOf(bestCourt), 1);
        for (const t of m.teams) {
          const u = usage.get(t) ?? Array(courts).fill(0);
          u[bestCourt]++;
          usage.set(t, u);
        }
        res.push({ id: m.id, slot, court: bestCourt });
        lastUsed = Math.max(lastUsed, slot);
      }
      slot++;
      if (++guard > 100000) throw new Error("Planification impossible");
    }
  }
  return res;
}

export function slotToDate(startIso: string, slot: number, o: Pick<ScheduleOptions, "matchDuration" | "breakDuration">): Date {
  return new Date(new Date(startIso).getTime() + slot * slotLength(o) * 60000);
}

/** Durée totale estimée en minutes (du premier coup d'envoi à la fin du dernier match). */
export function estimatedDuration(slots: Slotted[], o: ScheduleOptions): number {
  if (slots.length === 0) return 0;
  const last = Math.max(...slots.map((s) => s.slot));
  return last * slotLength(o) + o.matchDuration;
}
