import type { ManeuverType } from "@/lib/types";

const ARROW_BY_MANEUVER: Record<ManeuverType, string> = {
  depart: "🚶",
  "turn-left": "⬅️",
  "turn-slight-left": "↖️",
  "turn-sharp-left": "↙️",
  "turn-right": "➡️",
  "turn-slight-right": "↗️",
  "turn-sharp-right": "↘️",
  continue: "⬆️",
  uturn: "↩️",
  roundabout: "🔄",
  arrive: "🏁",
};

export function InstructionBanner({
  maneuver,
  distanceText,
  offRoute,
}: {
  maneuver: ManeuverType;
  distanceText: string;
  offRoute: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-4 px-4 py-5 shadow-md ${
        offRoute ? "bg-alert text-white" : "bg-moss-800 text-white"
      }`}
    >
      <span aria-hidden className="text-4xl leading-none">
        {offRoute ? "⚠️" : ARROW_BY_MANEUVER[maneuver]}
      </span>
      <p className="text-xl font-bold leading-tight">
        {offRoute ? "Je lijkt van de route af te zijn" : distanceText}
      </p>
    </div>
  );
}
