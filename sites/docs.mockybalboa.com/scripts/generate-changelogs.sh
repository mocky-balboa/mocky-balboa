#!/bin/bash

if [ -z "$CONTEXT" ]; then
  echo "Expected Netlify build env CONTEXT. Exiting."
  exit 1
fi

if [ "$CONTEXT" == "production" ]; then
  echo "Generating changelogs for main branch"
  pnpm -w exec changeset version
else
  echo "Generating changelogs for branch $CONTEXT"
  pnpm -w exec changeset version --snapshot canary
fi
