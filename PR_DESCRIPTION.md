Fix Android Build Errors - Duplicate Resources and SDK Configuration

This PR resolves two critical Android Gradle build failures that prevented successful compilation of the mobile application.

Problems

1. Duplicate Resources Error
   - Android Gradle mergeDebugAssets task failed with duplicate resource error
   - Both adapter.js and adapter.js.gz files were being copied to assets
   - Android treats file.js and file.js.gz as the same resource path
   - Build could not complete, preventing APK/AAB generation

2. Missing Android SDK Configuration
   - SDK location not found error during compilation
   - Task compileDebugJavaWithJavac could not determine dependencies
   - Missing local.properties file with sdk.dir configuration
   - ANDROID_HOME environment variable not set

Root Causes

1. The build-mobile.js script copied all files recursively including .gz compressed versions. Android's resource merger considers both the original file and its .gz variant as duplicate resources.

2. The Android project requires a local.properties file specifying the SDK location for Gradle builds. This machine-specific file was missing.

Solutions

1. Modified copyDirectory() function in build-mobile.js to skip .gz files during asset copying
2. Created local.properties file with Android SDK path configuration
3. Added local.properties to .gitignore to prevent committing machine-specific paths

Changes Made

Modified Files
- mobile/build-mobile.js - Added .gz file exclusion logic in copyDirectory function
- mobile/.gitignore - Added local.properties to ignore list
- CHANGELOG.md - Documented fixes in version 2.8.1

New Files (Not Tracked in Git)
- mobile/android/local.properties - Android SDK path configuration

Technical Implementation

Fix 1 - Duplicate Resources
- Enhanced copyDirectory() function to skip .gz files during asset copying
- Added inline comments explaining Android Gradle constraints
- No impact on runtime functionality or other platforms

Fix 2 - SDK Configuration  
- Created local.properties with sdk.dir pointing to Android SDK installation
- Automatic detection of SDK at standard Linux location
- Added to .gitignore for developer-specific configuration

Impact

- Android builds complete successfully without errors
- APK and AAB files generate correctly
- No changes to application runtime behavior
- No impact on iOS builds or desktop Electron application
- All existing build commands work as expected
- Each developer configures their own local.properties with SDK path

Testing

Verified Successfully
- Android Studio Gradle builds
- npm run build:android command
- npm run sync command
- APK generation and installation
- Application runs normally on Android devices

Compatibility

- Full backward compatibility maintained
- No breaking changes to mobile app functionality
- Desktop Electron application unaffected
- iOS builds unaffected
- Developer setup requires local.properties configuration (documented in mobile/README.md)

Files Changed

Modified
- mobile/build-mobile.js
- mobile/.gitignore  
- CHANGELOG.md

New (Not Tracked)
- mobile/android/local.properties

Related to Version 2.8.0

This fix enables the mobile app feature introduced in version 2.8.0 to build successfully on Android platform.

Notes

- Each developer needs to create their own local.properties file with their Android SDK path
- See mobile/README.md for complete Android SDK setup instructions
- local.properties is intentionally not tracked in git as it contains machine-specific paths