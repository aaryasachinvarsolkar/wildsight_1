# Eco Ranger Mobile (React Native)

Android-first field app for ranger validation in WildSight.

## Features in this scaffold
- Species scan form with confidence capture
- Automatic GPS capture of scan location
- Health assessment and validation decision
- Multi-image upload picker
- Offline queue with AsyncStorage
- Sync to shared backend endpoints

## Run
1. Install dependencies:
   npm.cmd install
2. Start app:
   npm.cmd run start
3. Open Android emulator/device via Expo.

## Backend contract
This app syncs with the same backend database used by the web dashboard through:
- POST /api/v1/eco-ranger/mobile/scans
- POST /api/v1/eco-ranger/mobile/validations
- GET /api/v1/eco-ranger/mobile/predictions

## Configuration
Edit src/services/api.js and set API_BASE_URL to your machine IP for device testing.
