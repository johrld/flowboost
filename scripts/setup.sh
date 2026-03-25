#!/bin/bash
# FlowBoost — Initial data setup
# Copies seed data to backend/data/ if it doesn't exist yet.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$ROOT_DIR/backend/data"
SEED_DIR="$ROOT_DIR/backend/data.seed"

if [ -d "$DATA_DIR/customers" ]; then
  echo "backend/data/ already exists, skipping seed."
  echo "To reset: rm -rf backend/data && bash scripts/setup.sh"
  exit 0
fi

if [ ! -d "$SEED_DIR" ]; then
  echo "Error: backend/data.seed/ not found."
  exit 1
fi

cp -r "$SEED_DIR" "$DATA_DIR"
echo "Seed data copied to backend/data/"
echo "Ready to start: docker compose up --build"
