from runner_api.models.strength import Exercise

BUILT_IN_EXERCISES = (
    Exercise(
        id="bench_press",
        name="Bench Press",
        category="barbell",
        default_max_source="bench_press",
        is_custom=False,
    ),
    Exercise(
        id="back_squat",
        name="Back Squat",
        category="barbell",
        default_max_source="back_squat",
        is_custom=False,
    ),
    Exercise(
        id="front_squat",
        name="Front Squat",
        category="barbell",
        default_max_source="front_squat",
        is_custom=False,
    ),
    Exercise(
        id="deadlift",
        name="Deadlift",
        category="barbell",
        default_max_source="deadlift",
        is_custom=False,
    ),
    Exercise(
        id="power_clean",
        name="Power Clean",
        category="olympic",
        default_max_source="power_clean",
        is_custom=False,
    ),
    Exercise(
        id="hang_power_clean",
        name="Hang Power Clean",
        category="olympic",
        default_max_source="power_clean",
        is_custom=False,
    ),
    Exercise(
        id="clean_pull",
        name="Clean Pull",
        category="olympic",
        default_max_source="power_clean",
        is_custom=False,
    ),
    Exercise(
        id="power_snatch",
        name="Power Snatch",
        category="olympic",
        default_max_source="power_snatch",
        is_custom=False,
    ),
    Exercise(
        id="hang_power_snatch",
        name="Hang Power Snatch",
        category="olympic",
        default_max_source="power_snatch",
        is_custom=False,
    ),
    Exercise(
        id="overhead_press",
        name="Overhead Press",
        category="barbell",
        default_max_source="overhead_press",
        is_custom=False,
    ),
    Exercise(
        id="chin_up",
        name="Chin-Up",
        category="bodyweight",
        default_max_source=None,
        is_custom=False,
    ),
    Exercise(
        id="db_row",
        name="DB Row",
        category="dumbbell",
        default_max_source=None,
        is_custom=False,
    ),
    Exercise(
        id="db_rfess",
        name="DB RFESS",
        category="dumbbell",
        default_max_source=None,
        is_custom=False,
    ),
    Exercise(
        id="farmers_walk",
        name="Farmers Walk",
        category="carry",
        default_max_source=None,
        is_custom=False,
    ),
)

BUILT_IN_EXERCISE_IDS = frozenset(item.id for item in BUILT_IN_EXERCISES)
