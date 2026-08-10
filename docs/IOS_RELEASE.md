# iOS release

Stand: 2026-08-10

The Capacitor shell is synchronized with `npm run cap:sync:ios` after a passing
web build. Before App Store submission:

1. Open the iOS workspace, select a valid signing team and unique bundle ID.
2. Test on a simulator and an unlocked physical device.
3. Verify network loss, resume, safe areas, keyboard, deep links and auth.
4. Add privacy manifest/labels and account-deletion information.
5. Archive a Release build and validate it in Xcode Organizer.
6. Upload to TestFlight and complete internal acceptance before review.

Xcode DeviceKit live-view timeouts are development tooling issues; unlock the
device, keep its screen active, reconnect and disable live previews if needed.

