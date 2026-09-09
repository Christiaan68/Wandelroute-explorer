import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DistanceUnit = "km";

interface SettingsState {
  voiceEnabled: boolean;
  /** Gebruiker heeft de privacy-uitleg over locatiegebruik gezien en bevestigd. */
  privacyAcknowledged: boolean;
  keepScreenAwakeDuringWalk: boolean;
  /**
   * Voorkeur "vermijd stoplichten en drukke oversteekplaatsen". Bewust
   * persistent (net als de andere instellingen hier): de gebruiker hoeft dit
   * niet elke keer opnieuw aan te zetten.
   */
  avoidTrafficLights: boolean;
  setVoiceEnabled: (enabled: boolean) => void;
  setPrivacyAcknowledged: (ack: boolean) => void;
  setKeepScreenAwakeDuringWalk: (enabled: boolean) => void;
  setAvoidTrafficLights: (enabled: boolean) => void;
}

/**
 * Instellingen zijn bewust klein en persisteren via localStorage (niet
 * IndexedDB): het zijn simpele losse voorkeuren, geen records die je wilt
 * doorzoeken/filteren zoals wandelgeschiedenis.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      voiceEnabled: true,
      privacyAcknowledged: false,
      keepScreenAwakeDuringWalk: true,
      avoidTrafficLights: false,
      setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
      setPrivacyAcknowledged: (ack) => set({ privacyAcknowledged: ack }),
      setKeepScreenAwakeDuringWalk: (enabled) => set({ keepScreenAwakeDuringWalk: enabled }),
      setAvoidTrafficLights: (enabled) => set({ avoidTrafficLights: enabled }),
    }),
    { name: "wandelroute-explorer:settings" },
  ),
);
