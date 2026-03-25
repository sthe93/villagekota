# Capacitor Deployment Guide (Apple App Store + Google Play)

This project is now scaffolded to be **Capacitor-ready**.

## What is configured

- `capacitor.config.ts` with app id/name and `webDir=dist`
- Router basename support for native runtime (`VITE_ROUTER_BASENAME=/`)
- Package scripts for add/sync/open/copy capacitor commands

## First-time setup

1. Install dependencies:

```bash
npm install
```

2. Build web assets for native shell:

```bash
npm run build:mobile
```

3. Create native projects:

```bash
npm run cap:add:android
npm run cap:add:ios
```

4. Sync web/native assets:

```bash
npm run cap:sync
```

5. Open native IDE projects:

```bash
npm run cap:open:android
npm run cap:open:ios
```

## Push notifications

The repo currently supports browser notifications. For app-store releases, implement and validate:

- APNs configuration for iOS
- Firebase Cloud Messaging for Android
- Permission prompt + token registration + backend delivery provider

## Store release checklist

- Generate/store proper app icons and launch screens in each native project
- Configure bundle identifiers and signing certificates/profiles
- Prepare store metadata and screenshots
- Run signed builds on real iOS and Android devices before submission

## Apple App Store readiness notes

- Ensure iOS permission copy in `ios/App/App/Info.plist` is final and product-approved:
  - `NSLocationWhenInUseUsageDescription` for driver live tracking
  - `NSFaceIDUsageDescription` for optional biometric verification
- Keep `ITSAppUsesNonExemptEncryption` aligned with release/export-compliance answers in App Store Connect.
- Verify app capability declarations in Xcode (Push Notifications / Background Modes) match implemented behavior before submission.

## Windows-friendly iOS testing path (via GitHub Actions)

You can trigger `.github/workflows/ios-testflight.yml` with **Run workflow** in GitHub Actions.
This builds on `macos-latest`, archives the Capacitor iOS app, exports an IPA, uploads it as an artifact,
and then submits the IPA to TestFlight.

Required GitHub secrets:

- `BUILD_CERTIFICATE_BASE64` (Apple Distribution `.p12`, base64-encoded)
- `P12_PASSWORD` (password for the `.p12`)
- `KEYCHAIN_PASSWORD` (temporary keychain password for CI)
- `BUILD_PROVISION_PROFILE_BASE64` (App Store provisioning profile, base64-encoded)
- `EXPORT_OPTIONS_PLIST_BASE64` (`ExportOptions.plist`, base64-encoded)
- `APPSTORE_ISSUER_ID` (App Store Connect API issuer id)
- `APPSTORE_API_KEY_ID` (App Store Connect API key id)
- `APPSTORE_API_PRIVATE_KEY` (contents of the `.p8` API key)
