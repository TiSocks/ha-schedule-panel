# Home Assistant Schedule Panel

A beautiful, fully interactive, 7-day calendar schedule panel for Home Assistant. 
It aggregates all of your schedule helpers and automations into a single, color-coded grid interface that mimics modern calendar applications.

<img width="1798" height="1000" alt="image" src="https://github.com/user-attachments/assets/0db177dd-6141-4d85-a4d5-250caf8730d3" />

## Features

- **Unified 7-Day Grid**: Instantly see all of your Home Assistant `schedule` helper entities perfectly aligned by time.
- **Interactive Drag-and-Drop Editing**: 
  - **Resize Times**: Drag the top or bottom handles of any schedule block to resize its start and end times directly.
  - **Shift Blocks**: Drag the center of a block to shift the entire time slot while preserving its duration.
  - **15-Minute Snapping**: Times automatically snap to 15-minute intervals for clean, precise adjustments.
  - **Auto-Persist**: Changes are saved instantly to Home Assistant using the WebSocket API.
- **Inline Schedule Creation with Multiple Time Ranges**: Click the "New Schedule" button to open a custom, modern modal dialog directly in your browser. Configure Name, Icon, select days of the week, and add **multiple "on" time ranges** (using a dynamic `+` button) to create advanced, recurring weekly schedules instantly without navigating away.
- **Click-to-Detailed-Settings**: Click on any schedule block (without dragging) to open the standard Home Assistant settings dialog.
- **Dynamic Updates**: Modifying a schedule instantly refreshes the panel so your view is never out of sync!
- **Automation Timers**: Highly visual red-dashed markers display any automations triggered by a specific time.
- **Zero Configuration**: Packaged as a Custom Integration, meaning the panel is registered automatically. **No `configuration.yaml` editing required!**
- **Browser Cache Invalidation**: Automatic query-string versioning prevents stale browser caching, ensuring new feature updates are served immediately upon upgrade.
- **YAML Safety & Error Recovery**: Gracefully intercepts save attempts on read-only (YAML-defined) schedules, showing a notification toast and rolling back the event card visually.

## Installation via HACS

Because this is a custom integration, you can easily install it using the Home Assistant Community Store (HACS).

1. Open Home Assistant and navigate to **HACS**.
2. Click on **Integrations** in the right panel.
3. Click the three dots in the top right corner and select **Custom repositories**.
4. In the URL field, paste exactly: `https://github.com/TiSocks/ha-schedule-panel`
5. In the Category dropdown, select **Integration**.
6. Click **Add**.
7. Close the custom repositories window and search for "Schedule Panel" in the main HACS search bar.
8. Click **Download** and then restart Home Assistant when prompted.

## Setup

Once you have installed the integration and restarted Home Assistant:

1. Go to **Settings > Devices & Services**.
2. Click **+ Add Integration** in the bottom right.
3. Search for **HA Schedule Panel** and click it.
4. It will install instantly! You'll now see a brand new "Schedules" tab right in your main left-hand sidebar!

Enjoy your new visual schedule manager!
