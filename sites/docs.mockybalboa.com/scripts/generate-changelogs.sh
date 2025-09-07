#!/bin/bash

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ -z "$BRANCH" ]; then
  echo "Unable to determine current git branch. Exiting."
  exit 1
fi

if [ "$BRANCH" == "main" ]; then
  echo "Generating changelogs for main branch"
  pnpm -w exec changeset version
else
  echo "Generating changelogs for branch $BRANCH"
  pnpm -w exec changeset version --snapshot canary
fi
