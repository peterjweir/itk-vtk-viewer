#!/bin/bash
npm install
# Build the TypeScript project
npm run build:debug

# Create a Docker image
docker build -t itk-viewer-local .

# Run the Docker container
docker run -it --rm -p 80:80 itk-viewer-local
