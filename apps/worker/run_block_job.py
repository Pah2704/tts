import json
import sys

from handlers.block_job import process_block_job


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(f"Failed to decode job payload: {exc}", file=sys.stderr)
        return 1

    try:
        process_block_job(payload)
    except Exception as exc:  # noqa: BLE001 - surface python failure to Node worker
        print(f"Job processing failed: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
