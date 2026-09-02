/**
 * Dunne wrapper rond de browser Web Speech API (SpeechSynthesis) voor
 * gesproken navigatie-instructies. Bewust een losse module (geen React) zodat
 * hij ook los te testen/mocken is.
 *
 * Eerlijke beperking: Web Speech API-ondersteuning (met name Nederlandse
 * stemmen) verschilt sterk per browser/OS. Chrome op Android en desktop
 * werkt doorgaans goed; Safari/iOS is wisselend. Zie README voor details.
 */
export class VoiceGuide {
  private enabled = true;

  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.cancel();
  }

  speak(text: string): void {
    if (!this.enabled || !this.isSupported()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "nl-NL";
    utterance.rate = 1.0;
    const dutchVoice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("nl"));
    if (dutchVoice) utterance.voice = dutchVoice;
    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    if (this.isSupported()) window.speechSynthesis.cancel();
  }
}

let singleton: VoiceGuide | null = null;
export function getVoiceGuide(): VoiceGuide {
  if (!singleton) singleton = new VoiceGuide();
  return singleton;
}
