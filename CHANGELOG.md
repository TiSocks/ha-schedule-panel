# Changelog

All notable changes to the HA Schedule Panel integration will be documented in this file.

## [1.0.17] - 2026-05-31
### Changed
- **Tidied up automation triggers UI**:
  - Removed the flashing/pulsing red status dot to declutter the dashboard.
  - Replaced the bright solid timeline overlay with a subtle, clean `1.5px` dashed line (`opacity: 0.45`). The line dynamically solidifies and glows on hover.
  - Collapsed the text label badges by default so they only display `[Icon] Time` (e.g., `19:45`).
  - Added a smooth CSS transition expansion that expands the badge to reveal the full name of the automation on hover.
  - Stripped solid red background from time badge for cleaner accent style.

## [1.0.16] - 2026-05-31
### Fixed
- **Reactive Automation Updates**: Added a reactive states change listener to detect when Home Assistant loads or updates automation entities, resolving a bug where automations failed to load during the initial connection phase.
- **Weekday Trigger Filtering**: Added parsing for the `weekday` option inside time triggers so automations are only shown on their specified weekdays.
- **Coercion Safety**: Added coercion safety for non-string YAML representations of time attributes to prevent parsing crashes.

## [1.0.15] - 2026-05-31
### Fixed
- **Trigger Schema Compatibility**: Added parsing compatibility for both `config.trigger` (singular) and `config.triggers` (plural) definitions, as well as `trigger: time` and `platform: time` syntax.
- **Verbose Debugging**: Introduced prefix-filtered `[Schedule Panel Debug]` console logs to simplify developer troubleshooting.

## [1.0.14] - 2026-05-31
### Fixed
- **Custom Element Registry Crash**: Wrapped `customElements.define` in a check for pre-existing registrations (`if (!customElements.get('schedule-panel'))`) to prevent uncaught exceptions on panel navigation or reload.

## [1.0.13] - 2026-05-31
### Fixed
- **WebSocket Response Key Nesting**: Corrected the WebSocket data extraction key to look inside `response.config` instead of the root response, resolving an issue where trigger rules returned as `undefined`.

## [1.0.12] - 2026-05-31
### Fixed
- **Automation Triggers Load Fail**: Replaced non-functional REST config call with parallel WebSocket requests (`type: 'automation/config'`) for all discovered automation entities.
- **Disabled State Handling**: Excluded disabled automations (`state === 'off'`) from displaying on the grid.

## [1.0.11] - 2026-05-31
### Added
- **Automation Timeline Flags**: Integrated time-triggered automations directly onto the weekly schedule grid with glowing timeline highlights, pulsing badges, and custom scale animations on hover.

## [1.0.10] - 2026-05-31
### Fixed
- **End-of-Day Microsecond Serialization Error**: Normalized Home Assistant's internal end-of-day timestamp (`"23:59:59.999999"`) to `"24:00:00"` to prevent backend validation failures.

## [1.0.9] - 2026-05-31
### Fixed
- **Midnight Validation Error**: Translated midnight end-times from `1440` minutes to `"24:00:00"`, satisfying the Home Assistant config helper schema.

## [1.0.8] - 2026-05-31
### Added
- **Multiple Time Ranges**: Added support for adding multiple "on" time ranges (via a dynamic `+` range button) in the schedule creation dialog.

## [1.0.7] - 2026-05-31
### Added
- **Schedule Creation Dialog**: Introduced an interactive creation modal to name, assign icons, choose active days, and create schedules directly from the sidebar.

## [1.0.6] - 2026-05-30
### Added
- **Release Automation**: Integrated GitHub Actions CI/CD workflow to auto-generate GitHub releases on tag push.

## [1.0.5] - 2026-05-30
### Fixed
- **Cache Invalidation**: Appended dynamic integration version queries (`?v={version}`) to the module URL inside Python's registration path to force browsers to reload modified JS.

## [1.0.3] - [1.0.4] - 2026-05-29
### Added
- **Drag-and-Drop Editor**: Implemented resizing (top/bottom handles) and sliding of schedule block events directly on the grid.
- **WebSocket updates**: Synced mouse/touch end events with `schedule/update`.

## [1.0.1] - [1.0.2] - 2026-05-29
### Added
- **Initial Release**: Initial integration setup, manifest files, brand icons, and registration framework.
