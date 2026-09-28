from datetime import date, timedelta


def get_week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())
