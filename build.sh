#!/bin/bash
rm -rf ./dist ./tsc &&
pnpm tsc -p tsconfig.build.json &&
node ./esbuild.js &&
cp ./src/index.ts ./dist/index.ts
