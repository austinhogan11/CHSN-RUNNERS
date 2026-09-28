import { useMemo, useState } from "react";

import { getWeekDates } from "../../utils/date";

interface WeekdaySelection {
  weekDates: string[];
  selectedDay: string;
  selectedWeekdayIndex: number;
  selectWeekday: (weekdayIndex: number) => void;
}

export function useWeekdaySelection(
  weekStart: string,
  today: string,
): WeekdaySelection {
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const [selectedWeekdayIndex, setSelectedWeekdayIndex] = useState(() => (
    weekDates.includes(today) ? weekDates.indexOf(today) : 0
  ));

  return {
    weekDates,
    selectedDay: weekDates[selectedWeekdayIndex],
    selectedWeekdayIndex,
    selectWeekday: setSelectedWeekdayIndex,
  };
}
