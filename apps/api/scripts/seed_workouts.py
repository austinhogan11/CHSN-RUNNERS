import argparse
from datetime import UTC, datetime
from typing import Any, cast

import boto3

from runner_api.data.workouts import WORKOUTS
from runner_api.repositories.workouts import workout_to_item

SEED_TIMESTAMP = datetime(2026, 9, 1, tzinfo=UTC)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed the Runner workout table with the demo sessions.",
    )
    parser.add_argument("--table-name", required=True)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--region", default="us-east-1")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    dynamodb = boto3.resource("dynamodb", region_name=args.region)
    table = cast(Any, dynamodb).Table(args.table_name)

    for workout in WORKOUTS:
        table.put_item(
            Item=workout_to_item(
                workout,
                user_id=args.user_id,
                created_at=SEED_TIMESTAMP,
                updated_at=SEED_TIMESTAMP,
            )
        )

    print(f"Seeded {len(WORKOUTS)} workouts into {args.table_name} for {args.user_id}.")


if __name__ == "__main__":
    main()
