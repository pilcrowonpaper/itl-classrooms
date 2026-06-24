#!/bin/bash

set -e

if [ -d "dist" ]; then
    rm -rf dist
fi

mkdir dist


cp assets/page.html dist/index.html
cp assets/script.js dist/
cp assets/stylesheet.css dist/

cat > dist/data.json
