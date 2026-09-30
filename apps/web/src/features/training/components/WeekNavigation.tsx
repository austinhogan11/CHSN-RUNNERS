import { formatWeekRange } from "../../../utils/date";

interface WeekNavigationProps {
  weekStart: string;
  isCurrentWeek: boolean;
  isLoading: boolean;
  error: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onCurrent: () => void;
}

export function WeekNavigation({
  weekStart,
  isCurrentWeek,
  isLoading,
  error,
  onPrevious,
  onNext,
  onCurrent,
}: WeekNavigationProps) {
  return (
    <div className="week-navigation">
      <div className="week-navigation-controls">
        <button className="navigation-button" type="button" aria-label="Previous week" disabled={isLoading} onClick={onPrevious}>‹</button>
        <strong>{formatWeekRange(weekStart)}</strong>
        <button className="navigation-button" type="button" aria-label="Next week" disabled={isLoading} onClick={onNext}>›</button>
      </div>
      <div className="week-navigation-feedback" aria-live="polite">
        {!isCurrentWeek && <button className="current-week-button" type="button" disabled={isLoading} onClick={onCurrent}>Current week</button>}
        {isLoading && <span className="sr-only" role="status">Updating week</span>}
        {!isLoading && error && <span className="navigation-status error" role="alert">{error}</span>}
      </div>
    </div>
  );
}
