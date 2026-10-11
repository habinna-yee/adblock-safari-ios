# Harbor interaction contract

Authority: the user's request is a Safari iOS blocker with desktop-style controls; Apple Safari Web Extension APIs constrain the implementation. README.md owns the platform and feature contract. DESIGN.md owns visual choices. This new project has no earlier sibling UI; popup and settings share Extension/ui.css and ui.js.

## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | ui.js + compiler.js | supported grammar in README | settings / popup | compiler and browser tests |
| Scrollbar | ui.css | DESIGN.md | system forced colors | static and browser inspection |
| Toast | ui.js status | this document | status / error | browser tests |
| CRUD | background.js save | README | settings / picker | state tests |

## State and behavior
Background owns serialized writes and revision conflicts. Apply rules, then commit storage; roll back rules on failure. On background wake, committed storage reconciles browser state. UI keeps drafts on error. A committed change broadcasts cosmetic refresh; network effects apply to future requests. User reload is explicit. Browser permission state is separate and never inferred from local preferences.

Allowed sites have visible add/read/remove controls; removal is reversible by readding. Custom rules have read/edit/save/discard and line deletion, with line-specific validation. These local reversible operations do not need modal confirmation. Drafts survive internal hash navigation; browser unload warns about unsaved edits. Removing the last exception shows the empty-state copy and returns focus to its input.

Picker is a non-modal selection region, not a dialog. It intercepts page selection while active, requires a separate Hide element action, supports parent selection and Escape/Cancel, and saves only on the current top-level website. It never runs page scripts or follows selected links.

## Permissions, retention, and service boundaries
No accounts, server, analytics, browsing-history retention, paid features, remote execution, or purchases. Host access is requested through Safari for the user-authorized blocking and picker features. Only preferences, custom filters and allowlist hosts persist. Packaged filter assets work offline; filter refresh is a developer/release process. Source is credited under GPLv3. User configuration is not exported or sent anywhere.

## Accessibility and localization
English UI; device locale for dates/numbers. Native label/control relationships, text errors, visible focus, 44px actions, live status, light/dark/forced colors and reduced motion. Native Safari and VoiceOver acceptance must be recorded separately from host or Chromium tests. No select/date/table capability applies.

## Cookie consent policy
The user explicitly requested necessary and functional cookies only, rejecting others. Consent automation defaults on and is separately reversible. Global and per-site pause also pause it. Known CMP adapters preflight all controls, reject unknown or locked optional categories, verify requested states, then use a provider-specific save-selection action. Generic Accept all and banner hiding never count as consent. No past cookies are deleted. Nine synthetic browser fixtures cover the four provider layouts and five refusal/pause paths; live-site acceptance remains separate.
