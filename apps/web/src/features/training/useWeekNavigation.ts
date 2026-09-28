import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { addCalendarDays } from "../../utils/date";

interface UseWeekNavigationOptions<TWeek> {
  currentWeekStart: string;
  loadWeek: (weekStart: string) => Promise<TWeek>;
  errorMessage?: string;
}

interface WeekNavigationState<TWeek> {
  week: TWeek | null;
  setWeek: Dispatch<SetStateAction<TWeek | null>>;
  displayedWeekStart: string;
  isCurrentWeek: boolean;
  isWeekLoading: boolean;
  weekError: string | null;
  showPreviousWeek: () => Promise<void>;
  showNextWeek: () => Promise<void>;
  showCurrentWeek: () => Promise<void>;
}

export function useWeekNavigation<TWeek>({
  currentWeekStart,
  loadWeek,
  errorMessage = "Unable to load selected week.",
}: UseWeekNavigationOptions<TWeek>): WeekNavigationState<TWeek> {
  const [week, setWeek] = useState<TWeek | null>(null);
  const [displayedWeekStart, setDisplayedWeekStart] = useState(currentWeekStart);
  const [isWeekLoading, setIsWeekLoading] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);

  const navigateToWeek = useCallback(async (targetWeekStart: string): Promise<void> => {
    if (isWeekLoading || targetWeekStart === displayedWeekStart) return;
    setIsWeekLoading(true);
    setWeekError(null);
    try {
      const loadedWeek = await loadWeek(targetWeekStart);
      setWeek(loadedWeek);
      setDisplayedWeekStart(targetWeekStart);
    } catch {
      setWeekError(errorMessage);
    } finally {
      setIsWeekLoading(false);
    }
  }, [displayedWeekStart, errorMessage, isWeekLoading, loadWeek]);

  return {
    week,
    setWeek,
    displayedWeekStart,
    isCurrentWeek: displayedWeekStart === currentWeekStart,
    isWeekLoading,
    weekError,
    showPreviousWeek: () => navigateToWeek(addCalendarDays(displayedWeekStart, -7)),
    showNextWeek: () => navigateToWeek(addCalendarDays(displayedWeekStart, 7)),
    showCurrentWeek: () => navigateToWeek(currentWeekStart),
  };
}
