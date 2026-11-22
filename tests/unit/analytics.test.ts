// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Google Analytics uitzetten bij intrekken van toestemming", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    for (const c of document.cookie.split(";")) {
      const name = c.split("=")[0]!.trim();
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
    delete (window as unknown as Record<string, unknown>).gtag;
  });

  it("verwijdert de _ga-cookies en laat andere cookies staan", async () => {
    document.cookie = "_ga=GA1.1.123; path=/";
    document.cookie = "_ga_TEST123=GS2.1.abc; path=/";
    document.cookie = "andere=blijft; path=/";
    const { deleteAnalyticsCookies } = await import("@/lib/analytics/ga");

    deleteAnalyticsCookies();

    expect(document.cookie).not.toMatch(/_ga/);
    expect(document.cookie).toMatch(/andere=blijft/);
  });

  it("zet de uitschakelvlag van gtag aan en stuurt een consent-update 'denied'", async () => {
    const gtag = vi.fn();
    (window as unknown as Record<string, unknown>).gtag = gtag;
    const { disableAnalytics, enableAnalytics } = await import("@/lib/analytics/ga");

    disableAnalytics();
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-TEST123"]).toBe(true);
    expect(gtag).toHaveBeenCalledWith("consent", "update", { analytics_storage: "denied" });

    enableAnalytics();
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-TEST123"]).toBe(false);
    expect(gtag).toHaveBeenLastCalledWith("consent", "update", { analytics_storage: "granted" });
  });
});
