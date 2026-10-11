# Verification — October 11, 2026

## Passed locally

- **21 Node checks** (including nested transaction tests): filter parsing, domain boundaries, resource scoping, network exceptions, badfilter cancellation, cosmetic exceptions, domain compaction, strict import errors, configuration persistence, rule replacement, allowlist CRUD, stale-write rejection, storage/Safari rollback, content-script authorization, scoped picker saves, unique dynamic-rule IDs, and independent/global/site cookie-automation pause. Full output: `unit-tests.txt`.
- **Manifest, JavaScript syntax and 13,153 compiled static-rule structural checks**: `static-checks.txt`.
- **9 browser consent fixtures** using the real `consent.js` in the Codex in-app browser: recognized OneTrust, Cookiebot, Complianz and CookieYes layouts preserve required cookies, enable functional/preferences cookies and disable other known categories; unknown, missing, locked, reverting and disabled states do not submit consent. Full visible result: `consent-tests.txt`.
- **Real DOM cosmetic/picker fixture, mocked messaging only:** bundled `content.js` hides `.sponsor`; opening picker, selecting `#test-promo`, confirming Hide element, saving via the fixture bridge and hiding the element succeed. Focus returns to Start element picker. See `picker-tests.txt` and `picker-result.jpg`.
- **UI preview, mocked extension APIs:** add/remove site exception, last-item empty state, invalid custom-filter line error, successful custom save, settings navigation, dark appearance, 390px and 320px iframe layouts inspected. `settings-preview.jpg`, `responsive-preview.jpg` show the actual rendered UI. The browser's viewport override did not change the outer UI width, so narrow checks used real iframe viewports instead.
- **Strict frontend static audit**: zero findings. `ui-audit.txt` and `../premium-audit.json`.
- **DESIGN.md lint**: zero errors; orphaned token warnings are documented in `design-lint.json`. Runtime tokens live in `Extension/ui.css`.
- **arm64 iOS compile/link/resource packaging**, Xcode 26.6 / iOS 26.5 SDK, with signing disabled and `Assets.xcassets` excluded. Includes both the SwiftUI app and embedded Safari Web Extension. `ios-build-summary.txt` records the exact command and result. This validates native compilation and package structure, not device behavior.

## Blocked or not verified

- **Full iOS build**: asset-catalog processing fails with `No available simulator runtimes for platform iphonesimulator`, after CoreSimulator service connection errors. Build without icon asset processing succeeds. Do not interpret that narrower build as a completed distribution build. The icon assets and normal build settings remain in the Xcode project for a configured development host.
- **Standalone Chromium extension test**: browser process is terminated by the host sandbox at startup (`SIGABRT`; process control also reports EPERM), before any test assertions. `tests/browser.mjs` is provided but has **not passed here**. The in-app preview does not substitute for real declarative-network-rule execution.
- **Safari extension packaging helper**: reports it cannot access/parse the supplied manifest path in this environment. The project was generated directly by `scripts/generate-project.py`; native compilation validates that project's targets and embedded resources. Actual Safari runtime manifest loading remains a device acceptance item.
- No signing team selected, signing credentials used, device installation, App Store upload, iPhone/iPad Safari validation, VoiceOver audit, physical touch test, or live provider consent test performed.
- Light theme, forced colors, reduced motion, keyboard matrix and offline behavior have source support but were not fully exercised in the native target.

## Required device acceptance before release

1. Build normally with icon assets and the owner's signing team. Install on an iPhone and iPad; verify the app icon, containing app and extension activation.
2. Test minimum iOS 16.4 and current Safari. Confirm both static lists load with no manifest/DNR errors, particularly `domains`, `excludedDomains`, `requestDomains` and grouped-domain rules.
3. Use a controlled publisher page and server request log to verify a blocked resource never reaches the server. Confirm first-/third-party restrictions, included/excluded domains and exception precedence.
4. Pause globally and per-site; test a subdomain and nested cross-origin frame. Reload and verify normal content resumes. Disable/re-enable each list independently.
5. Save, edit and remove a custom rule; close/reopen Safari and restart the device. Verify persistent state and UI synchronization. Exercise invalid selectors and a rejected Safari rule update.
6. Use the picker with physical touch, select a parent, cancel, save and remove its rule. Verify controls at large text sizes and VoiceOver navigation.
7. On consent-provider test pages in fresh browser sessions, inspect stored consent records/cookies: necessary + functional on; analytics/performance/advertising off. Test unknown/vendor/legitimate-interest panels and ensure they remain for manual handling. Do not use account-bearing or consequential live sessions for acceptance testing.
8. Exercise site access denied, private browsing, Safari “Turn Off Content Blockers,” offline reload, slow pages, dynamic banners, light/dark appearance and keyboard accessibility. Confirm no false protection or consent-success claims.

The implementation and fixture coverage are complete for this development version. Device behavior and release readiness remain open gates.
