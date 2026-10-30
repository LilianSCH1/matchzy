// Préférence « son activé », séparée du moteur audio (lib/client/fx.ts) pour que l'interrupteur
// puisse l'afficher sans charger ce dernier.

export const SOUND_KEY = "matchzy:sound";
export const SOUND_EVENT = "matchzy:sound";

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

export function storeSound(on: boolean) {
  try {
    if (on) localStorage.setItem(SOUND_KEY, "on");
    else localStorage.removeItem(SOUND_KEY);
  } catch {}
  window.dispatchEvent(new Event(SOUND_EVENT));
}
