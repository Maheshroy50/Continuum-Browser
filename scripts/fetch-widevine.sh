#!/bin/bash

# Directory setup
mkdir -p widevine
cd widevine

# Versions to try (newest to oldest widely compatible)
VERSIONS=("4.10.2710.0" "4.10.2662.3" "4.10.2557.0")
ARCH="mac-arm64"

for VER in "${VERSIONS[@]}"; do
    URL="https://dl.google.com/widevine-cdm/${VER}-${ARCH}.zip"
    echo "Attempting to download version ${VER} from ${URL}..."
    
    # Download
    curl -L -o "widevine.zip" "$URL" --fail
    
    if [ $? -eq 0 ]; then
        echo "Download successful!"
        # Unzip
        unzip -o widevine.zip
        
        # Check for the dylib
        if [ -f "libwidevinecdm.dylib" ]; then
            echo "Success! libwidevinecdm.dylib extracted."
            rm widevine.zip
            
            # Create manifest.json if missing (Electron sometimes needs it)
            if [ ! -f "manifest.json" ]; then
                echo "{\"version\": \"${VER}\", \"x-cdm-module-versions\": \"4\"}" > manifest.json
            fi
            
            exit 0
        else
            echo "Zip downloaded but libwidevinecdm.dylib not found inside."
        fi
    else
        echo "Failed to download version ${VER}"
    fi
done

echo "All download attempts failed."
exit 1
