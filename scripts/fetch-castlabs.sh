#!/bin/bash

mkdir -p widevine
cd widevine

echo "Searching for Castlabs Electron releases..."
# Fetch releases page (limited to recent)
curl -s "https://github.com/castlabs/electron-releases/releases" > releases.html

# Look for v35 tags (Chromium 134 equivalent)
TAG=$(grep -o "v35[^\"/]*" releases.html | head -n 1)

if [ -z "$TAG" ]; then
    echo "No v35 release found. Trying v34..."
    TAG=$(grep -o "v34[^\"/]*" releases.html | head -n 1)
fi

if [ -z "$TAG" ]; then
    echo "No suitable release found on Castlabs GitHub."
    exit 1
fi

echo "Found Release Tag: $TAG"

# Construct URL
# Format: https://github.com/castlabs/electron-releases/releases/download/TAG/electron-TAG-darwin-arm64.zip
FILENAME="electron-${TAG}-darwin-arm64.zip"
URL="https://github.com/castlabs/electron-releases/releases/download/${TAG}/${FILENAME}"

echo "Downloading ${FILENAME}..."
curl -L -o "electron.zip" "$URL" --fail

if [ $? -eq 0 ]; then
    echo "Download successful! Extracting Widevine CDM..."
    # We only need the dylib. It's usually deep inside.
    # Path: Electron.app/Contents/Frameworks/Electron Framework.framework/Libraries/WidevineCdm/_platform_specific/mac_arm64/libwidevinecdm.dylib
    
    # List files to confirm path (verbose but safer)
    unzip -l electron.zip | grep "libwidevinecdm.dylib"
    
    # Extract
    unzip -j electron.zip "**/libwidevinecdm.dylib"
    
    if [ -f "libwidevinecdm.dylib" ]; then
        echo "Success! libwidevinecdm.dylib extracted."
        rm electron.zip releases.html
        exit 0
    else
        echo "Extraction failed or file not found in zip."
    fi
else
    echo "Download failed."
    exit 1
fi
