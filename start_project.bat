@echo off
echo Starting MSA Project...

:: Start Backend in a new window
echo Starting Backend...
start "MSA Backend" cmd /k "cd backend && npm start"

:: Start Frontend (Android) in the current window (or spawns its own Metro bundler)
echo Starting Frontend...
cd turf_runner
npx react-native run-android

:: Return to root (optional)
cd ..