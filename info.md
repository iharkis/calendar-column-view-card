# Calendar Column View Card

A custom Home Assistant Lovelace card that displays multiple calendars in a column layout with hourly time slots.

## Key Features

✨ **Multi-calendar column view** - Display multiple calendars side-by-side
⏰ **Hourly time grid** - Customizable start and end hours
📊 **Overlap handling** - Overlapping events shown side-by-side with proportional widths
🎨 **Color coding** - Each calendar has its own distinctive color
📱 **Responsive design** - Adapts to different screen sizes
🎯 **Theme integration** - Uses your Home Assistant theme colors
🔄 **Date navigation** - Previous/Next day and Today buttons

## Perfect For

- Viewing multiple family member calendars together
- Comparing work and personal schedules
- Day-at-a-glance planning
- Scheduling meetings across multiple calendars
- Monitoring kids' activities alongside adult schedules

## Quick Configuration

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

## Compatible With

Works with any Home Assistant calendar integration:
- Google Calendar
- CalDAV (iCloud, Nextcloud, etc.)
- Local Calendar
- Office 365 Calendar
- And more!
