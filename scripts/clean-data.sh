#!/bin/bash
echo "Cleaning Continuum User Data..."

# Standard Electron User Data Paths
rm -rf "$HOME/Library/Application Support/continuum-browser"
rm -rf "$HOME/Library/Application Support/com.continuum.browser"
rm -rf "$HOME/Library/Application Support/com.flow.browser"
rm -rf "$HOME/Library/Application Support/Continuum"

# Old Local Development Data
rm -rf "./.continuum-userdata"
rm -rf "../.continuum-userdata"

echo "Cleanup Complete."
