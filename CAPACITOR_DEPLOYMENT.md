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
