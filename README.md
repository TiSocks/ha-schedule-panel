# Home Assistant Schedule Panel

A beautiful, fully interactive, 7-day calendar schedule panel for Home Assistant. 
It aggregates all of your schedule helpers and automations into a single, color-coded grid interface that mimics modern calendar applications.

![Screenshot](https://my.home-assistant.io/badges/hacs_custom.svg)

## Features
- **Unified 7-Day Grid**: Instantly see all of your Home Assistant `schedule` entities perfectly aligned by time.
- **Click-to-Edit**: Click directly on any schedule block to instantly pop open the Home Assistant settings dialog to modify its times.
- **Instant Creation**: Includes a dedicated "New Schedule" button that jumps you directly into the Home Assistant integration workflow to quickly create new schedules.
- **Dynamic Updates**: Modifying a schedule instantly refreshes the panel so your view is never out of sync!
- **Automation Timers**: Highly visual red-dashed markers display any automations triggered by a specific time.
- **Zero Configuration**: Packaged as a Custom Integration, meaning the panel is registered automatically! **No `configuration.yaml` editing required!**

## Installation via HACS

Because this is a custom integration, you can easily install it using the Home Assistant Community Store (HACS).

1. Open Home Assistant and navigate to **HACS**.
2. Click on **Integrations** in the right panel.
3. Click the three dots in the top right corner and select **Custom repositories**.
4. In the URL field, paste the link to this GitHub repository.
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
