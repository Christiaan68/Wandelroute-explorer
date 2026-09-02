"use client";

import { useCallback, useState } from "react";
import { apiGenerateRoute } from "@/lib/api-client";
import { usePlannerStore } from "@/lib/state/planner-store";
import type { RouteSearchParams } from "@/lib/types";

/**
 * Orkestreert het praten met de route-generate-API en het bijwerken van de
 * planner-store. Herbruikt tussen het zoekscherm (eerste zoekopdracht) en het
 * voorstelscherm ("andere route zoeken").
 */
export function useRouteSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const startSearch = usePlannerStore((s) => s.startSearch);
  const rejectCurrentAndSearchAgain = usePlannerStore((s) => s.rejectCurrentAndSearchAgain);
  const setProposal = usePlannerStore((s) => s.setProposal);
  const setNoAlternatives = usePlannerStore((s) => s.setNoAlternatives);
  const setError = usePlannerStore((s) => s.setError);

  const runGeneration = useCallback(
    async (params: RouteSearchParams) => {
      setIsLoading(true);
      try {
        const rejectedGeometries = usePlannerStore.getState().rejectedGeometries;
        const result = await apiGenerateRoute(params, rejectedGeometries);
        if (result.candidate) {
          setProposal(result.candidate);
        } else {
          setNoAlternatives(result.attemptsUsed);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [setProposal, setNoAlternatives, setError],
  );

  const search = useCallback(
    async (params: RouteSearchParams) => {
      startSearch(params);
      await runGeneration(params);
    },
    [startSearch, runGeneration],
  );

  const tryAnother = useCallback(async () => {
    rejectCurrentAndSearchAgain();
    const params = usePlannerStore.getState().params;
    if (!params) return;
    await runGeneration(params);
  }, [rejectCurrentAndSearchAgain, runGeneration]);

  const retryWithParams = useCallback(
    async (params: RouteSearchParams) => {
      startSearch(params);
      await runGeneration(params);
    },
    [startSearch, runGeneration],
  );

  return { search, tryAnother, retryWithParams, isLoading };
}
