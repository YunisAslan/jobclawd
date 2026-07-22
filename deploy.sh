#!/usr/bin/env bash
set -e
git pull origin main
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps