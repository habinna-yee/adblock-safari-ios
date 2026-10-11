# Harbor for iOS Safari

Harbor is an iOS/iPadOS app with a Safari Web Extension. It includes network ad/tracker blocking, cosmetic filtering, site exceptions, custom rules, a touch element picker, and automatic necessary/functional cookie choices on supported consent dialogs.

**This is a source project, not an installed or signed App Store app.** The app and extension compile/link for arm64 iOS when asset-catalog processing is excluded. A full build currently hits an unavailable CoreSimulator service during icon processing on the development host. Actual iPhone Safari blocking, signing, App Store distribution, native accessibility and live consent-provider acceptance remain unverified. See [verification/RESULTS.md](verification/RESULTS.md).

## Open and install

1. Open `iOS/Harbor.xcodeproj` in Xcode. Select the shared **Harbor** scheme.
2. Select your development team in **Signing & Capabilities** for both **Harbor** and **Harbor Extension**. Replace `com.example.Harbor` and `com.example.Harbor.Extension` with unique matching identifiers. The extension identifier must keep the containing app identifier as its prefix.
3. Select your connected iPhone/iPad (iOS **16.4 or newer**) and run. Xcode must have the matching platform support installed. An Apple signing identity and trusted development device are required.
4. On the device: **Settings → Apps → Safari → Extensions → Harbor**, enable Harbor and grant access to your chosen websites. On older iOS releases, Safari is directly under Settings. Private Browsing requires its separate permission.
5. Open a normal website in Safari, reload it, and choose Harbor from Safari’s page menu. Its **Settings** button opens the full configuration.

Do not enable automatic signing or upload an archive without selecting your own team. No credentials, certificates or signing identities are included.

## Features and limits

| Feature | Implementation |
|---|---|
| Ads and trackers | Packaged EasyList and EasyPrivacy subset; browser-native declarative network rules |
| Ad-space removal | Standard CSS element-hiding rules and cosmetic exceptions |
| Site controls | Pause on a hostname and its subdomains; explicit reload action |
| Custom rules | Validated ABP-style URL patterns and standard CSS selectors |
| Element picker | Tap an element, optionally select its parent, then confirm Hide element; edit/remove its rule in My filters |
| Cookie preferences | Enabled by default per the requested feature: necessary and functional/preferences categories on, analytics/performance/advertising and other recognized optional categories off |
| Storage | Device-local preferences, allowlist, custom rules; no account, analytics or browsing-history log |
| Filter updates | Bundled with app releases; developer updater below. No in-app subscriptions or scheduled downloads in this version |

**Desktop parity has limits.** iOS Safari does not provide blocking `webRequest` interception. Harbor does not run uBlock/AdGuard scriptlets, procedural filters, redirects, arbitrary JavaScript, request logging, or anti-adblock circumvention. It does not guarantee YouTube/video-ad removal and does not block ads in other apps. It cannot override Safari’s own content-blocker settings, website permissions or private-browsing permissions. Local controls show configured preferences, not proof that Safari granted access.

### Cookie consent coverage

The automation scans pages where Harbor has permission, and handles recognized category-panel layouts for **OneTrust, Cookiebot, Complianz and CookieYes**. Necessary cookies stay enabled; functional/preferences cookies are enabled; the remaining recognized categories are disabled. It verifies checkbox values before clicking a provider-specific **save selected preferences** action. It never clicks a generic Accept all button.

**No extension can promise this on all sites.** Custom dialogs, changed provider markup, consent walls, separate vendor/legitimate-interest panels, inaccessible frames, or locked optional categories are left for manual choice. The engine requires known category controls and a known save action; it refuses ambiguous layouts. Existing cookies are not deleted and previously stored consent is not rewritten without a visible banner. A site's classification of a cookie is outside Harbor's control. Functional does not mean that the site is trusted or that cookies were independently audited.

Global pause and site exceptions pause cookie automation too. Turn off only **Necessary + functional only** in Settings to keep ad blocking but make cookie choices yourself. Popup status describes the observed automation step; submission is not proof of server-side compliance.

### Bundled rules

The October 11, 2026 snapshots compile to **13,153 network rules** representing **109,052 supported network filters**, plus **24,032 cosmetic filters**. Equivalent pure-domain filters are grouped into domain arrays without changing action or scope. **4,464 unsupported source lines** are reported, never silently stripped of their options and converted to a broader block. Some standard CSS selectors may still be unsupported by the installed Safari version; those individual selectors are skipped at application time.

Exact source versions, SHA-256 hashes, compiled counts and build time: `Extension/rules/report.json`. Rejected source line numbers and reasons: `vendor/*-skipped.json`. The original lists retain their upstream comments and attribution.

### Custom filter grammar

Supported examples:

```text
! Lines beginning with ! are comments
||ads.example.com^
||tracker.example.com^$script,third-party
||ads.example.com^$domain=news.example|~safe.news.example
@@||cdn.example.com/needed.js
news.example.com##.sponsored
news.example.com#@#.allowed-ad
```

URL filters support ABP anchors/wildcards/separators, resource types (script, image, stylesheet, font, media, subdocument, xmlhttprequest, ping, websocket, other), negated resource types, third-party/~third-party, domain inclusion/exclusion, match-case, and network exceptions. Default rules exclude top-level navigation. `$document`, regex filters, redirects, important, removeparam, generichide and procedural/script filters are rejected. Use the site allowlist for document exceptions. Limits: 200 allowed hosts, 200,000 custom-filter characters, 4,500 total dynamic rules. Imported unknown syntax causes the entire save to fail with its line number.

The background is the single serialized writer. Browser rule changes are applied before storage commits; failures roll back to committed state. Revision checks prevent stale editors from silently overwriting other changes. On restart, the background reconciles rules from committed preferences. Cosmetic changes broadcast to open pages; network changes affect new requests, so reload is explicit.

## Development

No production npm dependencies. Node 20+ and Python 3 generate/check assets and the Xcode project.

```sh
npm test
npm run check
node scripts/build-filters.mjs       # rebuild from checked-in snapshots, offline
node scripts/update-filters.mjs      # download EasyList/EasyPrivacy over HTTPS and rebuild
python3 scripts/generate-project.py # deterministic Xcode project; resets signing identifiers
```

After updating filters, review skipped-rule reports, run checks, build, and complete the device matrix before shipping. The updater fetches text data only; it does not download or execute code. Browser storage is bounded and no filter source is fetched during normal browsing.

To run the real Chromium extension test on a host that permits launching browsers, install Playwright as a development tool, run `npx playwright install chromium`, then `node tests/browser.mjs`. The harness adapts only the background manifest to a Chromium service worker. A Chromium pass is **not** Safari acceptance.

For UI and consent fixtures: `node tests/preview-server.mjs`, then open `http://127.0.0.1:8765/options.html` and `/tests/consent-browser.html`. This localhost-only preview explicitly mocks extension APIs and is not part of the app bundle. `/tests/responsive.html` embeds 390px and 320px viewport reviews. `/tests/content-browser.html` exercises cosmetic hiding and the picker with a mocked messaging bridge.

## Source layout

- `Extension/`: Safari manifest, background transaction manager, filter compiler, cosmetic content script, cookie-consent engine, popup and settings.
- `iOS/`: SwiftUI installation guide, native extension handler, privacy manifests, icon assets and ready-to-open Xcode project.
- `vendor/`: unmodified upstream filter lists, GPLv3 text and skipped-line reports.
- `scripts/`, `tests/`, `verification/`: reproducible build/check scripts and honest validation evidence.

## Privacy and licenses

Harbor stores its configuration in Safari's local extension storage. It does not send browsing URLs or settings to a service. Pages receive their normal consent selections when automation saves preferences. Native messaging has no privileged actions. Removing the app/extension removes its local settings. Export/backup is not implemented.

Harbor source is provided under GPL-3.0-or-later; see LICENSE. EasyList and EasyPrivacy © their contributors are distributed under their GPLv3 option; upstream also offers CC BY-SA 3.0. The source snapshots and conversion reports are included to make this derivative inspectable. The icon is an original programmatically drawn asset. No Consent-O-Matic implementation code is bundled; its public rules were consulted as compatibility references.

## Technical references

- [Apple: blocking content with Safari Web Extensions](https://developer.apple.com/documentation/safariservices/blocking-content-with-your-safari-web-extension)
- [Apple: Safari extension compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)
- [MDN compatibility data: declarativeNetRequest](https://github.com/mdn/browser-compat-data/blob/main/webextensions/api/declarativeNetRequest.json) — legacy `domains`/`excludedDomains` are used for Safari 16.4 compatibility; `initiatorDomains` arrived in Safari 26.
- [EasyList license](https://easylist.to/pages/licence.html)
- [Consent-O-Matic provider-rule references](https://github.com/cavi-au/Consent-O-Matic/tree/master/rules)
