#!/bin/bash

mkdir -p widevine
cd widevine

VER="4.10.2710.0"
PLATFORMS=("mac" "macos" "osx" "darwin")
ARCHS=("arm64" "x64")

for P in "${PLATFORMS[@]}"; do
    for A in "${ARCHS[@]}"; do
        URL="https://dl.google.com/widevine-cdm/${VER}-${P}-${A}.zip"
        echo "Trying ${URL}..."
        curl -L -o "test.zip" "$URL" --fail
        
        if [ $? -eq 0 ]; then
            echo "FOUND! ${URL}"
            unzip -o test.zip
            if [ -f "libwidevinecdm.dylib" ]; then
                echo "Success!"
                rm test.zip
                exit 0
            fi
        fi
    done
done

echo "Failed."
exit 1
