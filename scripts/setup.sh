#!/bin/bash
# FlowBoost — Project setup
# Creates .env, configures authentication, and seeds initial data.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE="$ROOT_DIR/.env.example"
OVERRIDE_FILE="$ROOT_DIR/docker-compose.override.yml"
DATA_DIR="$ROOT_DIR/backend/data"
SEED_DIR="$ROOT_DIR/backend/data.seed"

echo ""
echo "  FlowBoost Setup"
echo "  ==============="
echo ""

# ── Step 1: Create .env ────────────────────────────────────

if [ ! -f "$ENV_FILE" ]; then
  if [ ! -f "$ENV_EXAMPLE" ]; then
    echo "Error: .env.example not found."
    exit 1
  fi
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created .env from .env.example"
else
  echo ".env already exists, keeping it."
fi

# ── Step 2: Authentication ─────────────────────────────────

echo ""
echo "  How do you want to authenticate with Claude?"
echo ""
echo "  1) API Key          — Anthropic Console key (pay-per-use)"
echo "  2) OAuth Token      — Access token from Max/Pro subscription"
echo "  3) CLI Login        — Log in inside the Docker container (recommended for Max/Pro)"
echo "  4) Skip             — Already configured"
echo ""
printf "  Choose [1-4]: "
read -r AUTH_CHOICE

case "$AUTH_CHOICE" in
  1)
    echo ""
    printf "  Paste your API key (sk-ant-...): "
    read -r API_KEY
    if [ -z "$API_KEY" ]; then
      echo "  No key entered, skipping."
    else
      # Set ANTHROPIC_API_KEY in .env
      if grep -q "^ANTHROPIC_API_KEY=" "$ENV_FILE"; then
        sed -i.bak "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$API_KEY|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
      else
        echo "ANTHROPIC_API_KEY=$API_KEY" >> "$ENV_FILE"
      fi
      echo "  Saved API key to .env"
    fi
    ;;
  2)
    echo ""
    echo "  On Linux:  cat ~/.claude/.credentials.json | grep accessToken"
    echo "  On macOS:  Open Keychain Access and search for 'claude'"
    echo ""
    printf "  Paste your OAuth token (sk-ant-oat01-...): "
    read -r AUTH_TOKEN
    if [ -z "$AUTH_TOKEN" ]; then
      echo "  No token entered, skipping."
    else
      # Set ANTHROPIC_AUTH_TOKEN in .env
      if grep -q "^# ANTHROPIC_AUTH_TOKEN=" "$ENV_FILE"; then
        sed -i.bak "s|^# ANTHROPIC_AUTH_TOKEN=.*|ANTHROPIC_AUTH_TOKEN=$AUTH_TOKEN|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
      elif grep -q "^ANTHROPIC_AUTH_TOKEN=" "$ENV_FILE"; then
        sed -i.bak "s|^ANTHROPIC_AUTH_TOKEN=.*|ANTHROPIC_AUTH_TOKEN=$AUTH_TOKEN|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
      else
        echo "ANTHROPIC_AUTH_TOKEN=$AUTH_TOKEN" >> "$ENV_FILE"
      fi
      echo "  Saved OAuth token to .env"
      echo ""
      echo "  Note: This token expires after a few months."
      echo "  When it does, update .env or switch to option 3 (CLI Login)."
    fi
    ;;
  3)
    echo ""
    # Create docker-compose.override.yml with named volume
    if [ -f "$OVERRIDE_FILE" ]; then
      echo "  docker-compose.override.yml already exists."
      echo "  Please add this manually if not already present:"
      echo ""
      echo "    services:"
      echo "      api:"
      echo "        volumes:"
      echo "          - claude-credentials:/root/.claude"
      echo "    volumes:"
      echo "      claude-credentials:"
    else
      cat > "$OVERRIDE_FILE" << 'YAML'
services:
  api:
    volumes:
      - claude-credentials:/root/.claude

volumes:
  claude-credentials:
YAML
      echo "  Created docker-compose.override.yml with credential volume."
    fi
    echo ""
    echo "  After starting the containers, run:"
    echo "    docker compose exec api claude auth login"
    echo ""
    echo "  This opens a URL — sign in with your Claude account."
    echo "  Credentials persist in the Docker volume across rebuilds."
    ;;
  4)
    echo "  Skipped."
    ;;
  *)
    echo "  Invalid choice, skipping authentication setup."
    ;;
esac

# ── Step 3: Gemini API Key (optional) ──────────────────────

echo ""
printf "  Google Gemini API key for image generation? (optional, Enter to skip): "
read -r GEMINI_KEY
if [ -n "$GEMINI_KEY" ]; then
  if grep -q "^GEMINI_API_KEY=" "$ENV_FILE"; then
    sed -i.bak "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=$GEMINI_KEY|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    echo "GEMINI_API_KEY=$GEMINI_KEY" >> "$ENV_FILE"
  fi
  echo "  Saved Gemini key to .env"
else
  echo "  Skipped (hero image generation will be disabled)."
fi

# ── Step 4: Seed data ──────────────────────────────────────

echo ""
if [ -d "$DATA_DIR/customers" ]; then
  echo "  Seed data already exists, skipping."
  echo "  To reset: rm -rf backend/data && bash scripts/setup.sh"
else
  if [ ! -d "$SEED_DIR" ]; then
    echo "  Error: backend/data.seed/ not found."
    exit 1
  fi
  mkdir -p "$DATA_DIR"
  cp -r "$SEED_DIR/customers" "$DATA_DIR/customers"
  echo "  Seed data copied to backend/data/"
fi

# ── Done ───────────────────────────────────────────────────

echo ""
echo "  Setup complete. Next steps:"
echo ""
echo "    docker compose up --build"
echo ""
if [ "$AUTH_CHOICE" = "3" ]; then
  echo "    # Then authenticate in a second terminal:"
  echo "    docker compose exec api claude auth login"
  echo ""
fi
echo "    Open http://localhost:6101"
echo ""
