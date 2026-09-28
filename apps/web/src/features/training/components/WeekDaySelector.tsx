import type { ReactNode } from "react";

import { formatCalendarDate } from "../../../utils/date";

interface WeekDaySelectorProps {
  weekDates: string[];
  selectedWeekdayIndex: number;
  today: string;
  onSelect: (weekdayIndex: number) => void;
  renderSummary: (day: string) => ReactNode;
}

export function WeekDaySelector({
  weekDates,
  selectedWeekdayIndex,
  today,
  onSelect,
  renderSummary,
}: WeekDaySelectorProps) {
  return (
    <ul className="week-overview" aria-label="Week overview">
      {weekDates.map((day, weekdayIndex) => {
        const isToday = day === today;
        return (
          <li key={day}>
            <button
              className={`overview-day${isToday ? " is-today" : ""}`}
              type="button"
              aria-label={`Select ${formatCalendarDate(day, { weekday: "long", month: "short", day: "numeric" })}${isToday ? ", today" : ""}`}
              aria-pressed={selectedWeekdayIndex === weekdayIndex}
              onClick={() => onSelect(weekdayIndex)}
            >
              <span className="overview-weekday">{formatCalendarDate(day, { weekday: "short" })}</span>
              <strong>{formatCalendarDate(day, { month: "short", day: "numeric" })}</strong>
              <span className="overview-day-summary">{renderSummary(day)}</span>
              {isToday && <span className="today-label">Today</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
