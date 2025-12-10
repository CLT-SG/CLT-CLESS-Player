#!/bin/bash

# Icon Verification Script for eCLESS Player Mobile
# This script verifies that all required Android icons are in place

echo "================================================"
echo "eCLESS Player Mobile - Icon Verification"
echo "================================================"
echo ""

# Check source icons
echo "✓ Checking source icons in resources/..."
if [ -f "resources/icon-only.png" ]; then
    SIZE=$(identify -format "%wx%h" resources/icon-only.png 2>/dev/null || echo "ImageMagick not installed")
    echo "  ✓ icon-only.png exists ($SIZE)"
else
    echo "  ✗ icon-only.png MISSING"
fi

if [ -f "resources/icon-foreground.png" ]; then
    SIZE=$(identify -format "%wx%h" resources/icon-foreground.png 2>/dev/null || echo "ImageMagick not installed")
    echo "  ✓ icon-foreground.png exists ($SIZE)"
else
    echo "  ✗ icon-foreground.png MISSING"
fi

if [ -f "resources/splash.png" ]; then
    SIZE=$(identify -format "%wx%h" resources/splash.png 2>/dev/null || echo "ImageMagick not installed")
    echo "  ✓ splash.png exists ($SIZE)"
else
    echo "  ✗ splash.png MISSING"
fi

echo ""
echo "✓ Checking generated Android icons..."

# Check mipmap directories
DENSITIES=("ldpi" "mdpi" "hdpi" "xhdpi" "xxhdpi" "xxxhdpi")
MISSING=0

for density in "${DENSITIES[@]}"; do
    DIR="android/app/src/main/res/mipmap-$density"
    if [ -d "$DIR" ]; then
        COUNT=$(ls -1 "$DIR"/*.png 2>/dev/null | wc -l)
        if [ "$COUNT" -ge 3 ]; then
            echo "  ✓ mipmap-$density: $COUNT icons"
        else
            echo "  ✗ mipmap-$density: Only $COUNT icons (expected 3+)"
            MISSING=$((MISSING + 1))
        fi
    else
        echo "  ✗ mipmap-$density: Directory missing"
        MISSING=$((MISSING + 1))
    fi
done

# Check adaptive icon XMLs
echo ""
echo "✓ Checking adaptive icon configuration..."
if [ -f "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml" ]; then
    echo "  ✓ ic_launcher.xml exists"
else
    echo "  ✗ ic_launcher.xml MISSING"
    MISSING=$((MISSING + 1))
fi

if [ -f "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml" ]; then
    echo "  ✓ ic_launcher_round.xml exists"
else
    echo "  ✗ ic_launcher_round.xml MISSING"
    MISSING=$((MISSING + 1))
fi

# Check splash screens
echo ""
echo "✓ Checking splash screens..."
SPLASH_DIRS=$(find android/app/src/main/res/drawable* -type d 2>/dev/null | wc -l)
SPLASH_FILES=$(find android/app/src/main/res/drawable*/splash.png 2>/dev/null | wc -l)
echo "  ✓ Splash directories: $SPLASH_DIRS"
echo "  ✓ Splash images: $SPLASH_FILES"

echo ""
echo "================================================"
if [ $MISSING -eq 0 ]; then
    echo "✅ All icons verified successfully!"
else
    echo "⚠️  Found $MISSING missing/incomplete icon sets"
    echo ""
    echo "To regenerate icons, run:"
    echo "  npm run generate:icons"
fi
echo "================================================"
