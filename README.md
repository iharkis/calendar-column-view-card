# Calendar Column View Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/custom-components/hacs)
[![GitHub Release](https://img.shields.io/github/release/iharkis/calendar-column-view-card.svg)](https://github.com/iharkis/calendar-column-view-card/releases)
[![License](https://img.shields.io/github/license/iharkis/calendar-column-view-card.svg)](LICENSE)

A custom Home Assistant Lovelace card that displays multiple calendars in a column layout, where each calendar is a column and each row represents an hour. Multi-hour events span multiple rows, and overlapping events are displayed side-by-side with proportional widths.

## Features

- **Multi-calendar column view**: Display multiple calendars side-by-side
- **Hourly time grid**: Customizable start and end hours
- **Overlap handling**: Overlapping events shown side-by-side with proportional widths
- **Date navigation**: Previous/Next day and Today buttons
- **Color coding**: Each calendar has its own color
- **Event details**: Shows event time, title, and location
- **Responsive design**: Adapts to different screen sizes
- **Theme integration**: Uses Home Assistant theme variables
- **Edge case handling**: Events continuing before/after visible range, minimum height for short events

## Installation

### HACS (Recommended)

1. **Add custom repository** (for testing):
   - Go to HACS → Frontend
   - Click the 3-dot menu (⋮) → Custom repositories
   - Add repository URL: `https://github.com/iharkis/calendar-column-view-card`
   - Category: **Lovelace**
   - Click "Add"

2. **Install the card**:
   - Find "Calendar Column View Card" in HACS Frontend
   - Click "Download"
   - Restart Home Assistant (may not be needed)

3. **Add the card to your dashboard** - the resource is automatically registered by HACS

### Manual Installation

1. **Download the JavaScript file:**
   - Download `calendar-column-view-card.js` from the [latest release](https://github.com/iharkis/calendar-column-view-card/releases)
   - Copy it to `/config/www/calendar-column-view-card.js`

2. **Add the card resource:**
   - Go to Settings → Dashboards → Resources
   - Click "Add Resource"
   - URL: `/local/calendar-column-view-card.js`
   - Resource type: JavaScript Module

3. **Clear browser cache** and refresh your dashboard

## Configuration

### Basic Configuration

Add a new card to your dashboard with the visual editor or YAML:

```yaml
type: custom:calendar-column-view-card
entities:
  - calendar.personal
  - calendar.work
  - calendar.family
start_hour: 6
end_hour: 22
title: My Calendars
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entities` | list | **Required** | List of calendar entity IDs to display |
| `start_hour` | number | `6` | Start hour (0-23) |
| `end_hour` | number | `22` | End hour (0-23) |
| `title` | string | `'Calendar View'` | Card title |
| `hour_height` | number | `60` | Height in pixels for each hour row |

### Example Configurations

**Work hours view (9am-5pm):**
```yaml
type: custom:calendar-column-view-card
entities:
  - calendar.work
  - calendar.meetings
start_hour: 9
end_hour: 17
title: Work Schedule
```

**Full day view (6am-10pm):**
```yaml
type: custom:calendar-column-view-card
entities:
  - calendar.personal
  - calendar.work
  - calendar.family
  - calendar.kids_activities
start_hour: 6
end_hour: 22
title: Family Calendar
```

**Custom hour height for more compact view:**
```yaml
type: custom:calendar-column-view-card
entities:
  - calendar.personal
  - calendar.work
start_hour: 8
end_hour: 20
hour_height: 40
title: Today's Schedule
```

## Usage

### Navigation

- **◀ Button**: Go to previous day
- **Today Button**: Return to today's date
- **▶ Button**: Go to next day

### Event Display

- Events show their start time, title, and location (if available)
- Overlapping events appear side-by-side with equal widths
- Events spanning multiple hours extend across multiple rows
- Short events have a minimum height for visibility
- Hover over events for full details in the tooltip

### Visual Indicators

- **↑** at top of event: Event started before visible hours
- **↓** at bottom of event: Event continues after visible hours
- **Color bar**: Left border matches calendar color

## Calendar Entity Requirements

This card works with any Home Assistant calendar integration:
- Google Calendar
- CalDAV (iCloud, Nextcloud, etc.)
- Local Calendar
- Office 365 Calendar
- Any other calendar integration that exposes calendar entities

Make sure your calendar entities are properly configured and showing in Home Assistant before using this card.

## Troubleshooting

### Card not showing

1. Verify the resource is added correctly:
   - Go to Settings → Dashboards → Resources
   - Confirm `/hacsfiles/calendar-column-view-card/calendar-column-view-card.js` is listed (HACS automatically adds this)

2. Check browser console for errors:
   - Press F12 to open developer tools
   - Look for errors in the Console tab

3. Restart Home Assistant and clear browser cache

### Events not displaying

1. Verify calendar entities exist:
   - Go to Developer Tools → States
   - Search for your calendar entities (e.g., `calendar.personal`)

2. Check calendar entity has events:
   - Click on the entity in Developer Tools
   - Verify it shows events in the attributes

3. Check date range:
   - Make sure you're viewing the correct date
   - Click "Today" to return to current date

### Configuration errors

- Ensure `entities` list is not empty
- Verify `start_hour` is less than `end_hour`
- Ensure hours are between 0 and 23

## Known Limitations

- All-day events are currently not displayed (will be added in future version)
- Events are fetched per day (no week view yet)
- No event creation/editing functionality
- Minimum supported screen width: ~400px

## Future Enhancements

- Week view option
- All-day events support
- Custom event templates
- Click to view event details in popup
- Filter events by keyword
- Export view as image
- Drag-and-drop event editing

## Support

For issues and feature requests:
- Open an issue on [GitHub](https://github.com/iharkis/calendar-column-view-card/issues)
- Check browser console for JavaScript errors (F12 → Console tab)
- Review the [troubleshooting section](#troubleshooting) above

## Version

Current version: 0.2.1

## License

This custom component is provided as-is for use with Home Assistant.
