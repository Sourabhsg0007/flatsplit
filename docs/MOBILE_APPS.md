# FlatSplit — iOS & Android apps (Capacitor)

FlatSplit ships to the App Store and Play Store using **Capacitor**: the same
React build runs inside a native shell. One codebase, three targets
(web / iOS / Android). The `android/` and `ios/` folders in this repo are the
native projects — commit them to git.

---

## How it fits together

```
src/  ──vite build──▶  dist/  ──npx cap sync──▶  android/ + ios/  ──▶ stores
```

`npx cap sync` copies `dist/` into both native projects and updates native
plugins. You never edit the copied web assets directly.

## Prerequisites

| Target  | You need                                                            |
|---------|---------------------------------------------------------------------|
| Android | Android Studio (any OS). Free Play Console account: $25 once.       |
| iOS     | A Mac with Xcode 15+. Apple Developer Program: $99/year.            |

## Everyday commands

```bash
npm run cap:sync       # build web + sync into both native projects
npm run cap:android    # build + sync + open Android Studio
npm run cap:ios        # build + sync + open Xcode
```

After any web code change, run `npm run cap:sync` before rebuilding the
native app — otherwise the shell keeps serving the old bundle.

---

## First Android build (10 minutes)

1. `npm run cap:android` — Android Studio opens the `android/` project.
2. Let Gradle finish syncing (bottom status bar).
3. Pick a device/emulator → **Run ▶**. FlatSplit boots natively.

### Release build for the Play Store
1. **Build → Generate Signed Bundle / APK → Android App Bundle**.
2. Create a keystore when prompted (**KEEP THIS FILE + PASSWORDS SAFE FOREVER**
   — losing it means you can never update the app; back it up outside the repo,
   never commit it).
3. Output: `android/app/release/app-release.aab`.
4. [play.google.com/console](https://play.google.com/console) → Create app →
   fill the listing (see checklist below) → Production → upload the `.aab` →
   roll out. First review typically takes 1–7 days.

## First iOS build (10 minutes, Mac only)

1. `npm run cap:ios` — Xcode opens `ios/App/App.xcworkspace`.
2. Select the **App** target → *Signing & Capabilities* → choose your Team
   (your Apple Developer account). Xcode manages certificates automatically.
3. Pick a simulator or plugged-in iPhone → **Run ▶**.

### Release build for the App Store
1. Select **Any iOS Device (arm64)** as destination.
2. **Product → Archive** → *Distribute App* → App Store Connect → Upload.
3. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps →
   New App (bundle id `app.flatsplit.expenses`) → fill the listing → pick the
   uploaded build → Submit for Review. Typically 1–3 days.

---

## App icons & splash screens

Generate every required size from one image pair:

```bash
npm i -D @capacitor/assets
# put icon.png (1024×1024) and splash.png (2732×2732) in ./resources
npx capacitor-assets generate
```

Use the ÷ brand mark on the pine background (`#21312A`) — matching the
in-app splash so launch feels seamless.

## Store listing checklist (both stores)

- **Name:** FlatSplit — Split & Settle
- **Short description:** Shared expenses for flatmates — split, settle via UPI, done.
- **Screenshots:** phone screenshots of Balances, Activity, Insights, Personal,
  Settle-with-UPI. (Take them in the simulator/emulator; both stores require
  specific sizes — the consoles list them.)
- **Privacy policy URL:** required by both stores. Host a simple page (a
  GitHub Pages page works) stating: account email + display name stored via
  Supabase; expense data stored to provide the service; bank statements are
  processed on-device and never uploaded; no ads; no data sold.
- **Data safety / App privacy forms:** declare email + name (account),
  user-generated content (expenses). Bank statements: not collected
  (on-device only) — this is true and a genuinely strong privacy story.
- **Category:** Finance.

---

## Things to know (read before v1 submission)

### Google sign-in inside the native app
Google **blocks OAuth inside plain webviews** ("disallowed_useragent"), so the
*Continue with Google* button may fail in the native shells. Email/password
works natively out of the box. Options, in order of effort:
1. **v1: rely on email/password** in the native apps (the button can stay —
   web users still use it).
2. Later: add `@capacitor/browser` and complete OAuth in the system browser
   with a deep-link redirect back into the app (Supabase supports this via
   a custom URL scheme redirect). Happy to wire this when you want it.

### UPI deep links
Work **better** natively than on the web — Android resolves `tez://`,
`phonepe://` etc. straight into the apps. No changes needed.

### Updating the app after web changes
Store apps bundle the web build, so shipping a change means: bump the version
in `package.json`, `npm run cap:sync`, rebuild/rearchive, upload to both
consoles. (The Vercel web app keeps updating instantly as before.)

### What's intentionally not in the native projects' git
`android/app/src/main/assets/public/` and `ios/App/App/public/` are the copied
web build — regenerated by every `cap sync`. They're gitignored; don't commit
them. Your signing keystore must also never be committed.

### PDF import in native apps
Works — pdf.js runs inside the shell webview like any browser. The lazy-loaded
chunk is bundled with the app, so it works offline too.
