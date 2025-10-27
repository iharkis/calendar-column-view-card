/**
 * Calendar Column View Card
 * A custom Home Assistant card that displays multiple calendars in columns
 */

class CalendarColumnViewCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._selectedDate = new Date();
    this._events = {};
    this._loading = false;
    this._error = null;
    this._selectedEvent = null;
  }

  setConfig(config) {
    if (!config.entities || !Array.isArray(config.entities) || config.entities.length === 0) {
      throw new Error('You must define at least one calendar entity');
    }

    // Normalize entities to support both string and object formats
    const normalizedEntities = config.entities.map((entity, index) => {
      if (typeof entity === 'string') {
        // Simple format: 'calendar.name'
        return {
          entity: entity,
          name: null, // Will use friendly_name from entity
          color: null, // Will use default color
        };
      } else if (typeof entity === 'object' && entity.entity) {
        // Object format: { entity: 'calendar.name', name: 'Custom', color: '#ff0000' }
        return {
          entity: entity.entity,
          name: entity.name || null,
          color: entity.color || null,
        };
      } else {
        throw new Error('Invalid entity format');
      }
    });

    this.config = {
      entities: normalizedEntities,
      start_hour: config.start_hour !== undefined ? config.start_hour : 6,
      end_hour: config.end_hour !== undefined ? config.end_hour : 22,
      title: config.title || 'Calendar View',
      hour_height: config.hour_height || 60,
      time_format: config.time_format || '24h', // '12h' or '24h'
      show_all_day_events: config.show_all_day_events !== false, // default true
      compact_mode: config.compact_mode || false,
    };

    // Validate hours
    if (this.config.start_hour < 0 || this.config.start_hour > 23) {
      throw new Error('start_hour must be between 0 and 23');
    }
    if (this.config.end_hour < 0 || this.config.end_hour > 23) {
      throw new Error('end_hour must be between 0 and 23');
    }
    if (this.config.start_hour >= this.config.end_hour) {
      throw new Error('start_hour must be less than end_hour');
    }

    this.render();
  }

  set hass(hass) {
    this._hass = hass;

    // Fetch events when hass is first set or when entities change
    if (!this._eventsLoaded) {
      this._fetchEvents();
      this._eventsLoaded = true;
    }

    // Don't re-render if modal is open (prevents flashing)
    if (!this._selectedEvent) {
      this.render();
    }
  }

  _formatDateTime(date) {
    // Format as 'YYYY-MM-DDTHH:mm:ss' (same format as Atomic Calendar)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  async _fetchEvents() {
    if (!this._hass || !this.config) return;

    this._loading = true;
    this._error = null;
    this.render();

    try {
      const startDateTime = new Date(this._selectedDate);
      startDateTime.setHours(0, 0, 0, 0);

      const endDateTime = new Date(this._selectedDate);
      endDateTime.setHours(23, 59, 59, 999);

      const startTime = this._formatDateTime(startDateTime);
      const endTime = this._formatDateTime(endDateTime);

      const events = {};

      for (const entityConfig of this.config.entities) {
        const entityId = entityConfig.entity;
        try {
          console.log(`Fetching events for ${entityId} from ${startTime} to ${endTime}`);

          // Use the same method as Atomic Calendar Revive
          const url = `calendars/${entityId}?start=${startTime}&end=${endTime}`;
          console.log('Fetching from URL:', url);

          const calendarEvents = await this._hass.callApi('GET', url);
          console.log(`Response for ${entityId}:`, calendarEvents);
          console.log(`Number of events: ${calendarEvents ? calendarEvents.length : 0}`);
          if (calendarEvents && calendarEvents.length > 0) {
            console.log('First event structure:', calendarEvents[0]);
          }
          events[entityId] = calendarEvents || [];
        } catch (error) {
          console.error(`Error fetching events for ${entityId}:`, error);
          events[entityId] = [];
        }
      }

      this._events = events;
      this._loading = false;
      this.render();
    } catch (error) {
      console.error('Error fetching events:', error);
      this._error = 'Failed to load events';
      this._loading = false;
      this.render();
    }
  }

  _previousDay() {
    const newDate = new Date(this._selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    this._selectedDate = newDate;
    this._fetchEvents();
  }

  _nextDay() {
    const newDate = new Date(this._selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    this._selectedDate = newDate;
    this._fetchEvents();
  }

  _today() {
    this._selectedDate = new Date();
    this._fetchEvents();
  }

  _formatDate(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    if (compareDate.getTime() === today.getTime()) {
      return 'Today';
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (compareDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (compareDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    }

    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  }

  _formatTime(hour) {
    if (this.config.time_format === '12h') {
      const period = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${hour12}:00 ${period}`;
    }
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  _formatEventTime(date) {
    if (this.config.time_format === '12h') {
      return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  _getCalendarColor(entityId, index) {
    // First check if there's a custom color in the config
    const entityConfig = this.config.entities.find(e => e.entity === entityId);
    if (entityConfig && entityConfig.color) {
      return entityConfig.color;
    }

    // Try to use calendar's configured color from entity attributes
    if (this._hass && this._hass.states[entityId]) {
      const stateObj = this._hass.states[entityId];
      if (stateObj.attributes && stateObj.attributes.color) {
        return stateObj.attributes.color;
      }
    }

    // Fallback to predefined palette
    const colors = [
      '#4285f4', // Blue
      '#ea4335', // Red
      '#fbbc04', // Yellow
      '#34a853', // Green
      '#9c27b0', // Purple
      '#ff6d00', // Orange
      '#00bcd4', // Cyan
      '#e91e63', // Pink
    ];

    return colors[index % colors.length];
  }

  _parseEventTime(eventDateTime, visibleStartHour) {
    const eventTime = new Date(eventDateTime);
    const hours = eventTime.getHours();
    const minutes = eventTime.getMinutes();

    // Convert to position relative to visible start
    const rowPosition = (hours - visibleStartHour) + (minutes / 60);
    return rowPosition;
  }

  _calculateEventBlock(event, startHour, endHour, rowHeight) {
    const startPos = this._parseEventTime(event.start.dateTime, startHour);
    const endPos = this._parseEventTime(event.end.dateTime, startHour);

    // Clamp to visible range
    const clampedStart = Math.max(0, startPos);
    const clampedEnd = Math.min(endHour - startHour, endPos);

    return {
      top: clampedStart * rowHeight,
      height: Math.max((clampedEnd - clampedStart) * rowHeight, 20), // Minimum 20px height
      startsBeforeView: startPos < 0,
      endsAfterView: endPos > (endHour - startHour),
    };
  }

  _eventsOverlap(event1, event2) {
    const start1 = new Date(event1.start.dateTime);
    const end1 = new Date(event1.end.dateTime);
    const start2 = new Date(event2.start.dateTime);
    const end2 = new Date(event2.end.dateTime);

    return start1 < end2 && start2 < end1;
  }

  _detectOverlaps(events) {
    // Sort events by start time
    const sorted = [...events].sort((a, b) =>
      new Date(a.start.dateTime) - new Date(b.start.dateTime)
    );

    const groups = [];

    for (const event of sorted) {
      let addedToGroup = false;

      for (const group of groups) {
        // Check if event overlaps with any event in this group
        const overlaps = group.some(groupEvent => this._eventsOverlap(event, groupEvent));

        if (overlaps) {
          group.push(event);
          addedToGroup = true;
          break;
        }
      }

      if (!addedToGroup) {
        groups.push([event]);
      }
    }

    return groups;
  }

  _calculateOverlapLayout(overlapGroups) {
    const layouts = [];

    for (const group of overlapGroups) {
      const width = 100 / group.length;
      const gap = 2; // 2% gap between events

      group.forEach((event, index) => {
        layouts.push({
          event: event,
          width: `calc(${width}% - ${gap}px)`,
          left: `calc(${width * index}% + ${index > 0 ? gap : 0}px)`,
        });
      });
    }

    return layouts;
  }

  _renderAllDayEvents(entityId, color) {
    if (!this.config.show_all_day_events) return '';

    const events = this._events[entityId] || [];

    // Filter all-day events (events with just date, not dateTime)
    const allDayEvents = events.filter(event =>
      (event.start && event.start.date && !event.start.dateTime) ||
      (event.start && event.start.dateTime && event.end && event.end.dateTime &&
       new Date(event.end.dateTime) - new Date(event.start.dateTime) >= 86400000)
    );

    return allDayEvents.map(event => {
      const title = event.summary || 'Untitled Event';
      const eventDate = event.start?.date || event.start?.dateTime;
      const eventId = `${entityId}-allday-${eventDate}`;

      return `
        <div class="all-day-event event-clickable"
             data-event-id="${eventId}"
             style="background-color: ${color}; border: 1px solid rgba(0, 0, 0, 0.3);"
             title="Click for details">
          ${title}
        </div>
      `;
    }).join('');
  }

  _getEventHourCell(eventDateTime, startHour) {
    const eventTime = new Date(eventDateTime);
    const eventHour = eventTime.getHours();
    return eventHour - startHour; // Which hour cell (0 = start_hour)
  }

  _renderEventsForHour(entityId, hour, color) {
    const events = this._events[entityId] || [];

    // Filter timed events that start in this hour
    const hourEvents = events.filter(event => {
      if (!event.start || !event.start.dateTime || !event.end || !event.end.dateTime) {
        return false;
      }
      // Exclude events that span 24+ hours (treat as all-day)
      const duration = new Date(event.end.dateTime) - new Date(event.start.dateTime);
      if (duration >= 86400000) return false;

      const startTime = new Date(event.start.dateTime);
      return startTime.getHours() === hour;
    });

    if (hourEvents.length === 0) return '';

    return hourEvents.map(event => {
      const startTime = new Date(event.start.dateTime);
      const endTime = new Date(event.end.dateTime);

      const startMinutes = startTime.getMinutes();
      const durationMs = endTime - startTime;
      const durationMinutes = durationMs / (1000 * 60);

      // Calculate position based on start minutes within the hour
      const top = (startMinutes / 60) * this.config.hour_height;
      const height = Math.max((durationMinutes / 60) * this.config.hour_height, 20);

      const timeStr = this._formatEventTime(startTime);
      const title = event.summary || 'Untitled Event';

      // Create unique event ID for click handling
      const eventId = `${entityId}-${startTime.getTime()}`;

      // For short events (< 35 minutes), use inline layout or title-only
      const isShortEvent = durationMinutes < 35;
      const isTinyEvent = height < 25;

      return `
        <div class="event event-clickable ${isShortEvent ? 'event-short' : ''} ${isTinyEvent ? 'event-tiny' : ''}"
             data-event-id="${eventId}"
             style="
               top: ${top}px;
               height: ${height}px;
               background-color: ${color};
               border: 1px solid rgba(0, 0, 0, 0.3);
             "
             title="Click for details">
          ${isTinyEvent ? `
            <div class="event-title-only">${title}</div>
          ` : isShortEvent ? `
            <div class="event-inline">
              <span class="event-time-inline">${timeStr}</span>
              <span class="event-title-inline">${title}</span>
            </div>
          ` : `
            <div class="event-time">${timeStr}</div>
            <div class="event-title">${title}</div>
            ${event.location && !this.config.compact_mode ? `<div class="event-location">${event.location}</div>` : ''}
          `}
        </div>
      `;
    }).join('');
  }

  _adjustColor(color, amount) {
    // Simple color adjustment for border
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  _getCalendarName(entityId) {
    // First check if there's a custom name in the config
    const entityConfig = this.config.entities.find(e => e.entity === entityId);
    if (entityConfig && entityConfig.name) {
      return entityConfig.name;
    }

    // Fall back to entity's friendly_name
    if (this._hass && this._hass.states[entityId]) {
      const stateObj = this._hass.states[entityId];
      return stateObj.attributes.friendly_name || entityId.replace('calendar.', '');
    }
    return entityId.replace('calendar.', '');
  }

  _showEventDetails(eventId, entityId, color) {
    // Find the event in the events data
    const events = this._events[entityId] || [];
    let selectedEvent = null;

    // Search for the event by ID
    for (const event of events) {
      const timeStamp = event.start?.dateTime ? new Date(event.start.dateTime).getTime() : null;
      const checkId = `${entityId}-${timeStamp}`;
      const allDayId = `${entityId}-allday-${event.start?.date || event.start?.dateTime}`;

      if (checkId === eventId || allDayId === eventId) {
        selectedEvent = {
          ...event,
          entityId,
          color
        };
        break;
      }
    }

    if (selectedEvent) {
      this._selectedEvent = selectedEvent;
      this.render();
    }
  }

  _closeEventDetails() {
    this._selectedEvent = null;
    this.render();
  }

  _renderEventModal() {
    if (!this._selectedEvent) return '';

    const event = this._selectedEvent;
    const isAllDay = event.start?.date && !event.start?.dateTime;

    let startStr, endStr, durationStr;

    if (isAllDay) {
      const startDate = new Date(event.start.date);
      const endDate = event.end?.date ? new Date(event.end.date) : null;

      startStr = startDate.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (endDate && endDate > startDate) {
        endDate.setDate(endDate.getDate() - 1); // Calendar API returns day after
        endStr = endDate.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        durationStr = `${days} day${days > 1 ? 's' : ''}`;
      }
    } else {
      const startDate = new Date(event.start.dateTime);
      const endDate = new Date(event.end.dateTime);

      startStr = startDate.toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: this.config.time_format === '12h' ? 'numeric' : '2-digit',
        minute: '2-digit',
        hour12: this.config.time_format === '12h'
      });

      endStr = endDate.toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: this.config.time_format === '12h' ? 'numeric' : '2-digit',
        minute: '2-digit',
        hour12: this.config.time_format === '12h'
      });

      const durationMs = endDate - startDate;
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    const calendarName = this._getCalendarName(event.entityId);
    const title = event.summary || 'Untitled Event';
    const description = event.description || '';
    const location = event.location || '';

    return `
      <div class="event-modal-overlay" id="event-modal-overlay">
        <div class="event-modal">
          <div class="event-modal-header" style="border-left: 4px solid ${event.color};">
            <h3>${title}</h3>
            <button class="modal-close" id="modal-close">×</button>
          </div>
          <div class="event-modal-body">
            <div class="event-modal-section">
              <div class="event-modal-label">Calendar</div>
              <div class="event-modal-value">
                <span class="color-indicator" style="background-color: ${event.color};"></span>
                ${calendarName}
              </div>
            </div>

            ${isAllDay ? `
              <div class="event-modal-section">
                <div class="event-modal-label">Date</div>
                <div class="event-modal-value">${startStr}</div>
              </div>
              ${endStr ? `
                <div class="event-modal-section">
                  <div class="event-modal-label">End Date</div>
                  <div class="event-modal-value">${endStr}</div>
                </div>
                <div class="event-modal-section">
                  <div class="event-modal-label">Duration</div>
                  <div class="event-modal-value">${durationStr}</div>
                </div>
              ` : ''}
            ` : `
              <div class="event-modal-section">
                <div class="event-modal-label">Start</div>
                <div class="event-modal-value">${startStr}</div>
              </div>
              <div class="event-modal-section">
                <div class="event-modal-label">End</div>
                <div class="event-modal-value">${endStr}</div>
              </div>
              <div class="event-modal-section">
                <div class="event-modal-label">Duration</div>
                <div class="event-modal-value">${durationStr}</div>
              </div>
            `}

            ${location ? `
              <div class="event-modal-section">
                <div class="event-modal-label">Location</div>
                <div class="event-modal-value">${location}</div>
              </div>
            ` : ''}

            ${description ? `
              <div class="event-modal-section">
                <div class="event-modal-label">Description</div>
                <div class="event-modal-value event-description">${description}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.config) return;

    const hours = [];
    for (let h = this.config.start_hour; h <= this.config.end_hour; h++) {
      hours.push(h);
    }

    const totalHeight = (this.config.end_hour - this.config.start_hour) * this.config.hour_height;

    const compactClass = this.config.compact_mode ? 'compact-mode' : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --calendar-column-bg: var(--card-background-color, white);
          --calendar-border: var(--divider-color, #e0e0e0);
          --calendar-text: var(--primary-text-color, black);
          --calendar-secondary-text: var(--secondary-text-color, #757575);
          --event-border-radius: 4px;
        }

        .card {
          background: var(--calendar-column-bg);
          border-radius: var(--ha-card-border-radius, 4px);
          box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0,0,0,0.1));
          padding: 16px;
          overflow: hidden;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          gap: 8px;
        }

        .header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 500;
          color: var(--calendar-text);
        }

        .navigation {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .date-display {
          font-size: 18px;
          font-weight: 500;
          color: var(--calendar-text);
          min-width: 200px;
          text-align: center;
        }

        button {
          background: var(--primary-color, #03a9f4);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
          line-height: 1.5;
          height: 36px;
          box-sizing: border-box;
          transition: background 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        button:hover {
          background: var(--dark-primary-color, #0288d1);
        }

        button:active {
          transform: scale(0.98);
        }

        .nav-button {
          padding: 8px 12px;
          min-width: 40px;
        }

        .calendar-container {
          overflow-x: auto;
          border: 1px solid var(--calendar-border);
          border-radius: 4px;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: 60px repeat(${this.config.entities.length}, 1fr);
          grid-auto-rows: auto;
        }

        /* Header row */
        .grid-cell-header {
          padding: 8px;
          text-align: center;
          font-weight: 500;
          color: var(--calendar-text);
          border-bottom: 2px solid var(--calendar-border);
          background: var(--calendar-column-bg);
          position: sticky;
          top: 0;
          z-index: 10;
          box-sizing: border-box;
        }

        .grid-cell-header.time-col {
          border-right: 1px solid var(--calendar-border);
        }

        .grid-cell-header:not(.time-col) {
          border-right: 1px solid var(--calendar-border);
        }

        .grid-cell-header:nth-child(${this.config.entities.length + 1}n) {
          border-right: none;
        }

        .color-indicator {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-right: 6px;
          vertical-align: middle;
        }

        /* All-day row */
        .grid-cell-allday {
          border-bottom: 2px solid var(--calendar-border);
          background: var(--calendar-column-bg);
          min-height: 38px;
          padding: 4px 8px;
          font-size: 10px;
          color: var(--calendar-secondary-text);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .grid-cell-allday.time-col {
          border-right: 1px solid var(--calendar-border);
          text-align: center;
          align-items: center;
        }

        .grid-cell-allday:not(.time-col) {
          border-right: 1px solid var(--calendar-border);
        }

        .grid-cell-allday:nth-child(${this.config.entities.length + 1}n) {
          border-right: none;
        }

        .all-day-event {
          border-radius: var(--event-border-radius);
          padding: 4px 8px;
          margin: 2px 0;
          font-size: 12px;
          color: white;
          font-weight: 500;
          cursor: pointer;
        }

        .all-day-event:hover {
          opacity: 0.9;
        }

        /* Hour rows */
        .grid-cell-hour {
          height: ${this.config.hour_height}px;
          border-bottom: 1px solid var(--calendar-border);
          position: relative;
          box-sizing: border-box;
        }

        .grid-cell-hour.time-col {
          border-right: 1px solid var(--calendar-border);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          font-size: 12px;
          color: var(--calendar-secondary-text);
          box-sizing: border-box;
          padding: 0;
        }

        .grid-cell-hour:not(.time-col) {
          border-right: 1px solid var(--calendar-border);
        }

        .grid-cell-hour:nth-child(${this.config.entities.length + 1}n) {
          border-right: none;
        }

        .event {
          position: absolute;
          border-radius: var(--event-border-radius);
          padding: 4px 6px;
          font-size: 12px;
          color: white;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.1s;
          box-sizing: border-box;
          left: 0;
          right: 0;
        }

        .event:hover {
          transform: translateX(-2px);
          box-shadow: 2px 2px 8px rgba(0,0,0,0.2);
          z-index: 100;
        }

        .event-time {
          font-weight: 600;
          font-size: 11px;
          margin-bottom: 2px;
          opacity: 0.95;
        }

        .event-title {
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .event-location {
          font-size: 10px;
          opacity: 0.85;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-top: 2px;
        }

        /* Short event styles */
        .event-short {
          padding: 2px 4px;
        }

        .event-tiny {
          padding: 1px 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .event-title-only {
          font-size: 10px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
        }

        .event-inline {
          display: flex;
          align-items: center;
          gap: 4px;
          overflow: hidden;
        }

        .event-time-inline {
          font-weight: 600;
          font-size: 10px;
          opacity: 0.95;
          flex-shrink: 0;
        }

        .event-title-inline {
          font-weight: 500;
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .event-continues-before,
        .event-continues-after {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          opacity: 0.7;
        }

        .event-continues-before {
          top: 2px;
        }

        .event-continues-after {
          bottom: 2px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: var(--calendar-secondary-text);
        }

        .error {
          text-align: center;
          padding: 40px;
          color: var(--error-color, #f44336);
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: var(--calendar-secondary-text);
        }

        .event-clickable {
          cursor: pointer;
        }

        /* Compact Mode Styles */
        .compact-mode .card {
          padding: 8px;
        }

        .compact-mode .header {
          margin-bottom: 8px;
        }

        .compact-mode .header h2 {
          font-size: 18px;
        }

        .compact-mode .grid-cell-hour {
          height: ${this.config.hour_height * 0.8}px;
        }

        .compact-mode .grid-cell-allday {
          min-height: 28px;
          padding: 2px 6px;
        }

        .compact-mode .all-day-event {
          font-size: 11px;
          padding: 2px 6px;
          margin: 1px 0;
        }

        .compact-mode .event {
          padding: 2px 4px;
        }

        .compact-mode .event-time {
          font-size: 10px;
        }

        .compact-mode .event-title {
          font-size: 11px;
        }

        /* Event Modal Styles */
        .event-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .event-modal {
          background: var(--calendar-column-bg);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .event-modal-header {
          padding: 20px;
          border-bottom: 1px solid var(--calendar-border);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .event-modal-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--calendar-text);
          flex: 1;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 28px;
          color: var(--calendar-secondary-text);
          cursor: pointer;
          padding: 0;
          line-height: 1;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .modal-close:hover {
          background: var(--divider-color, #e0e0e0);
        }

        .event-modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .event-modal-section {
          margin-bottom: 16px;
        }

        .event-modal-section:last-child {
          margin-bottom: 0;
        }

        .event-modal-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--calendar-secondary-text);
          margin-bottom: 6px;
          letter-spacing: 0.5px;
        }

        .event-modal-value {
          font-size: 15px;
          color: var(--calendar-text);
          line-height: 1.5;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .event-modal-value .color-indicator {
          flex-shrink: 0;
        }

        .event-description {
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        @media (max-width: 768px) {
          .card {
            padding: 12px;
          }

          .header h2 {
            font-size: 20px;
          }

          .date-display {
            font-size: 16px;
            min-width: 150px;
          }

          .calendar-column {
            min-width: 120px;
          }

          button {
            padding: 6px 12px;
            font-size: 12px;
          }

          .nav-button {
            padding: 6px 10px;
          }
        }
      </style>

      <div class="${compactClass}">
      <div class="card">
        <div class="header">
          <h2>${this.config.title}</h2>
          <div class="navigation">
            <button class="nav-button">◀</button>
            <button>Today</button>
            <div class="date-display">${this._formatDate(this._selectedDate)}</div>
            <button class="nav-button">▶</button>
          </div>
        </div>

        ${this._loading ? `
          <div class="loading">Loading events...</div>
        ` : this._error ? `
          <div class="error">${this._error}</div>
        ` : `
          <div class="calendar-container">
            <div class="calendar-grid">
              <!-- Header row -->
              <div class="grid-cell-header time-col"></div>
              ${this.config.entities.map((entityConfig, index) => {
                const entityId = entityConfig.entity;
                const color = this._getCalendarColor(entityId, index);
                const name = this._getCalendarName(entityId);
                return `
                  <div class="grid-cell-header">
                    <span class="color-indicator" style="background-color: ${color};"></span>
                    ${name}
                  </div>
                `;
              }).join('')}

              <!-- All-day row -->
              ${this.config.show_all_day_events ? `
                <div class="grid-cell-allday time-col">All Day</div>
                ${this.config.entities.map((entityConfig, index) => {
                  const entityId = entityConfig.entity;
                  const color = this._getCalendarColor(entityId, index);
                  return `
                    <div class="grid-cell-allday">
                      ${this._renderAllDayEvents(entityId, color)}
                    </div>
                  `;
                }).join('')}
              ` : ''}

              <!-- Hour rows -->
              ${hours.map(hour => `
                <div class="grid-cell-hour time-col">${this._formatTime(hour)}</div>
                ${this.config.entities.map((entityConfig, index) => {
                  const entityId = entityConfig.entity;
                  const color = this._getCalendarColor(entityId, index);
                  return `
                    <div class="grid-cell-hour">
                      ${this._renderEventsForHour(entityId, hour, color)}
                    </div>
                  `;
                }).join('')}
              `).join('')}
            </div>
          </div>
        `}

        <!-- Event Details Modal -->
        ${this._renderEventModal()}
      </div>
      </div>
    `;

    // Add event listeners after rendering
    this._attachEventListeners();
  }

  _attachEventListeners() {
    const prevButton = this.shadowRoot.querySelector('.nav-button:first-of-type');
    const todayButton = this.shadowRoot.querySelector('button:nth-of-type(2)');
    const nextButton = this.shadowRoot.querySelector('.nav-button:last-of-type');

    if (prevButton) {
      prevButton.addEventListener('click', () => this._previousDay());
    }
    if (todayButton) {
      todayButton.addEventListener('click', () => this._today());
    }
    if (nextButton) {
      nextButton.addEventListener('click', () => this._nextDay());
    }

    // Add event click listeners
    const clickableEvents = this.shadowRoot.querySelectorAll('.event-clickable');
    clickableEvents.forEach(eventEl => {
      eventEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const eventId = eventEl.dataset.eventId;

        // Find the entity ID and color from parent elements
        let entityId = null;
        let color = null;

        // Extract entity ID from event ID
        // Event ID format: "calendar.name-timestamp" or "calendar.name-allday-date"
        const lastDashIndex = eventId.lastIndexOf('-');
        if (lastDashIndex > 0) {
          const beforeLastDash = eventId.substring(0, lastDashIndex);
          // Check if it's an allday event (has two dashes)
          const secondLastDashIndex = beforeLastDash.lastIndexOf('-');
          if (eventId.includes('-allday-') && secondLastDashIndex > 0) {
            entityId = beforeLastDash.substring(0, secondLastDashIndex);
          } else {
            entityId = beforeLastDash;
          }
        }

        // Get color from the event's background color
        const bgColor = eventEl.style.backgroundColor;
        if (bgColor) {
          // Convert rgb to hex if needed
          color = bgColor;
        }

        // Find color from config
        const entityIndex = this.config.entities.findIndex(e => e.entity === entityId);
        if (entityIndex !== -1) {
          color = this._getCalendarColor(entityId, entityIndex);
        }

        console.log('[Event Click] Event ID:', eventId);
        console.log('[Event Click] Extracted Entity ID:', entityId);
        console.log('[Event Click] Color:', color);

        if (entityId) {
          this._showEventDetails(eventId, entityId, color);
        } else {
          console.error('[Event Click] Could not extract entity ID from:', eventId);
        }
      });
    });

    // Modal close listeners
    const modalOverlay = this.shadowRoot.getElementById('event-modal-overlay');
    const modalClose = this.shadowRoot.getElementById('modal-close');

    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this._closeEventDetails();
        }
      });
    }

    if (modalClose) {
      modalClose.addEventListener('click', () => this._closeEventDetails());
    }
  }

  getCardSize() {
    return 3;
  }

  static getConfigElement() {
    return document.createElement('calendar-column-view-card-editor');
  }

  static getStubConfig() {
    return {
      entities: [],
      start_hour: 6,
      end_hour: 22,
      title: 'Calendar View',
    };
  }
}

/**
 * Calendar Column View Card Editor
 * Visual configuration editor for the card using Home Assistant UI components
 */
class CalendarColumnViewCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  connectedCallback() {
    this.loadCustomElements();
  }

  disconnectedCallback() {
    // Clean up debounce timeout to prevent memory leaks
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
    }
  }

  async loadCustomElements() {
    // Load ha-entity-picker and other HA components
    if (!customElements.get('ha-entity-picker')) {
      await customElements.get('hui-entities-card')?.getConfigElement();
    }
  }

  setConfig(config) {
    // Normalize entities in the same way as the main card
    const normalizedEntities = (config.entities || []).map((entity, index) => {
      if (typeof entity === 'string') {
        return { entity: entity, name: null, color: null };
      } else if (typeof entity === 'object' && entity.entity) {
        return {
          entity: entity.entity,
          name: entity.name || null,
          color: entity.color || null,
        };
      } else {
        return { entity: '', name: null, color: null };
      }
    });

    const newConfig = {
      ...config, // Preserve all original config including type
      entities: normalizedEntities,
      start_hour: config.start_hour !== undefined ? config.start_hour : 6,
      end_hour: config.end_hour !== undefined ? config.end_hour : 22,
      title: config.title || 'Calendar View',
      hour_height: config.hour_height || 60,
      time_format: config.time_format || '24h',
      show_all_day_events: config.show_all_day_events !== false,
      compact_mode: config.compact_mode || false,
    };

    // Check if config actually changed - prevents unnecessary re-renders
    if (this._config && this._configsEqual(this._config, newConfig)) {
      console.log('[Calendar Editor] Config unchanged, skipping render');
      return; // No change, skip everything
    }

    console.log('[Calendar Editor] Config changed, updating editor');
    this._config = newConfig;

    // If editor already exists, just update values without re-rendering
    if (this.shadowRoot && this.shadowRoot.querySelector('.editor-container')) {
      console.log('[Calendar Editor] Updating field values only');
      this._updateFieldValues();
    } else {
      console.log('[Calendar Editor] Full render (first time)');
      this.render();
    }
  }

  _configsEqual(config1, config2) {
    // Deep compare configs to detect actual changes
    if (config1.title !== config2.title) return false;
    if (config1.start_hour !== config2.start_hour) return false;
    if (config1.end_hour !== config2.end_hour) return false;
    if (config1.hour_height !== config2.hour_height) return false;
    if (config1.time_format !== config2.time_format) return false;
    if (config1.show_all_day_events !== config2.show_all_day_events) return false;
    if (config1.compact_mode !== config2.compact_mode) return false;

    // Compare entities array (now objects with entity, name, color)
    if (config1.entities.length !== config2.entities.length) return false;
    for (let i = 0; i < config1.entities.length; i++) {
      const e1 = config1.entities[i];
      const e2 = config2.entities[i];
      if (e1.entity !== e2.entity || e1.name !== e2.name || e1.color !== e2.color) {
        return false;
      }
    }

    return true;
  }

  _updateFieldValues() {
    // Update field values without destroying/recreating them
    const titleField = this.shadowRoot.getElementById('title-field');
    const startHourField = this.shadowRoot.getElementById('start-hour-field');
    const endHourField = this.shadowRoot.getElementById('end-hour-field');
    const hourHeightField = this.shadowRoot.getElementById('hour-height-field');
    const entitiesList = this.shadowRoot.getElementById('entities-list');

    // Get the currently focused element (could be the inner input of ha-textfield)
    const activeElement = this.shadowRoot.activeElement;
    const focusedField = activeElement?.shadowRoot?.activeElement || activeElement;

    // Only update if value has actually changed AND field is not focused (prevents cursor jumps)
    if (titleField && titleField !== activeElement && titleField !== focusedField) {
      if (titleField.value !== this._config.title) {
        titleField.value = this._config.title || '';
      }
    }
    if (startHourField && startHourField !== activeElement && startHourField !== focusedField) {
      if (Number(startHourField.value) !== this._config.start_hour) {
        startHourField.value = this._config.start_hour;
      }
    }
    if (endHourField && endHourField !== activeElement && endHourField !== focusedField) {
      if (Number(endHourField.value) !== this._config.end_hour) {
        endHourField.value = this._config.end_hour;
      }
    }
    if (hourHeightField && hourHeightField !== activeElement && hourHeightField !== focusedField) {
      if (Number(hourHeightField.value) !== this._config.hour_height) {
        hourHeightField.value = this._config.hour_height;
      }
    }

    // Re-render entities list if it changed
    if (entitiesList) {
      this._renderEntitiesList(entitiesList);
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    // Update ha-entity-picker with hass (don't re-render entire editor)
    const addEntityPicker = this.shadowRoot?.getElementById('add-entity-picker');
    if (addEntityPicker && addEntityPicker.hass !== hass) {
      addEntityPicker.hass = hass;
    }
  }

  _valueChanged(ev) {
    if (!this._config || !this._hass) {
      return;
    }

    ev.stopPropagation();
    const target = ev.target;
    const configPath = target.getAttribute('name');

    if (!configPath) {
      return;
    }

    let value;
    if (target.type === 'checkbox') {
      // Handle checkboxes first
      value = target.checked;
    } else if (ev.detail && ev.detail.value !== undefined) {
      // ha-entity-picker and other HA components use detail.value
      value = ev.detail.value;
    } else if (target.value !== undefined) {
      // ha-textfield and regular inputs
      if (target.type === 'number') {
        value = Number(target.value);
      } else {
        value = target.value;
      }
    } else {
      return;
    }

    console.log(`Updating config ${configPath} to:`, value);

    // Set config value immediately (for internal state)
    this._config = {
      ...this._config,
      [configPath]: value,
    };

    // Debounce the config-changed event to prevent HA from interfering with focus
    // Clear any pending timeout
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
    }

    // Wait 300ms after last keystroke before notifying Home Assistant
    this._debounceTimeout = setTimeout(() => {
      console.log(`[Calendar Editor] Debounced: Firing config-changed for ${configPath}`);
      this._fireConfigChanged();
    }, 300);
  }

  _fireConfigChanged() {
    const event = new Event('config-changed', {
      bubbles: true,
      composed: true,
    });
    event.detail = { config: this._config };
    this.dispatchEvent(event);
  }

  render() {
    if (!this._config) {
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        .editor-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px 0;
        }

        .option {
          margin: 0;
        }

        .option > label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: var(--primary-text-color);
          font-size: 14px;
        }

        ha-textfield,
        ha-entity-picker {
          width: 100%;
        }

        select {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px;
          font-size: 14px;
          background: var(--card-background-color, white);
          color: var(--primary-text-color);
          cursor: pointer;
        }

        select:focus {
          outline: none;
          border-color: var(--primary-color, #03a9f4);
        }

        input[type="checkbox"] {
          margin-right: 8px;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        label:has(input[type="checkbox"]) {
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .description {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-top: 4px;
          margin-bottom: 8px;
        }

        .hour-inputs {
          display: flex;
          gap: 16px;
        }

        .hour-inputs > div {
          flex: 1;
        }

        #entities-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 12px;
          min-height: 20px;
        }

        .entity-row {
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          padding: 12px;
          background: var(--card-background-color, white);
        }

        .entity-row-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }

        .entity-name {
          flex: 1;
          font-weight: 500;
          color: var(--primary-text-color);
        }

        .entity-row-remove {
          cursor: pointer;
          padding: 4px 8px;
          margin: 0;
          background: var(--error-color, #f44336);
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          line-height: 1;
          transition: opacity 0.2s;
        }

        .entity-row-remove:hover {
          opacity: 0.8;
        }

        .entity-row-config {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .config-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .config-field label {
          font-size: 12px;
          color: var(--secondary-text-color);
          font-weight: 500;
        }

        .config-field input[type="text"] {
          padding: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px;
          font-size: 14px;
          background: var(--card-background-color, white);
          color: var(--primary-text-color);
        }

        .config-field input[type="text"]:focus {
          outline: none;
          border-color: var(--primary-color, #03a9f4);
        }

        .color-input-wrapper {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .entity-color-picker {
          width: 50px;
          height: 36px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px;
          cursor: pointer;
        }

        .entity-color-text {
          flex: 1;
          padding: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px;
          font-size: 14px;
          font-family: monospace;
          background: var(--card-background-color, white);
          color: var(--primary-text-color);
        }

        .entity-color-text:focus {
          outline: none;
          border-color: var(--primary-color, #03a9f4);
        }

        .color-reset {
          padding: 6px 10px;
          background: var(--secondary-background-color, #f5f5f5);
          color: var(--primary-text-color);
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          transition: background 0.2s;
        }

        .color-reset:hover {
          background: var(--divider-color, #e0e0e0);
        }

        .color-indicator {
          display: inline-block;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid var(--divider-color, #e0e0e0);
        }

        .no-entities {
          color: var(--secondary-text-color);
          font-style: italic;
          font-size: 14px;
        }

        @media (max-width: 600px) {
          .entity-row-config {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <div class="editor-container">
        <div class="option">
          <ha-textfield
            id="title-field"
            label="Card Title"
            name="title"
          ></ha-textfield>
          <div class="description">The title displayed at the top of the card</div>
        </div>

        <div class="option">
          <label>Calendar Entities</label>
          <div id="entities-list"></div>
          <ha-entity-picker
            id="add-entity-picker"
            label="Add Calendar"
          ></ha-entity-picker>
          <div class="description">Select calendars to add to the card</div>
        </div>

        <div class="hour-inputs">
          <div>
            <ha-textfield
              id="start-hour-field"
              label="Start Hour"
              name="start_hour"
              type="number"
              min="0"
              max="23"
            ></ha-textfield>
            <div class="description">First hour to display (0-23)</div>
          </div>

          <div>
            <ha-textfield
              id="end-hour-field"
              label="End Hour"
              name="end_hour"
              type="number"
              min="0"
              max="23"
            ></ha-textfield>
            <div class="description">Last hour to display (0-23)</div>
          </div>
        </div>

        <div class="option">
          <ha-textfield
            id="hour-height-field"
            label="Hour Height (pixels)"
            name="hour_height"
            type="number"
            min="40"
            max="200"
          ></ha-textfield>
          <div class="description">Height of each hour row (default: 60px)</div>
        </div>

        <div class="option">
          <label>Time Format</label>
          <select id="time-format-field" name="time_format">
            <option value="24h">24-hour (14:00)</option>
            <option value="12h">12-hour (2:00 PM)</option>
          </select>
          <div class="description">Choose between 12-hour and 24-hour time display</div>
        </div>

        <div class="option">
          <label>
            <input type="checkbox" id="show-all-day-field" name="show_all_day_events" />
            Show All-Day Events
          </label>
          <div class="description">Display all-day events in a separate row</div>
        </div>

        <div class="option">
          <label>
            <input type="checkbox" id="compact-mode-field" name="compact_mode" />
            Compact Mode
          </label>
          <div class="description">Reduce spacing and hide some details for a more compact view</div>
        </div>
      </div>
    `;

    // Now set properties and attach listeners
    this._attachEditorComponents();
  }

  _attachEditorComponents() {
    // Get references to all components
    const titleField = this.shadowRoot.getElementById('title-field');
    const addEntityPicker = this.shadowRoot.getElementById('add-entity-picker');
    const entitiesList = this.shadowRoot.getElementById('entities-list');
    const startHourField = this.shadowRoot.getElementById('start-hour-field');
    const endHourField = this.shadowRoot.getElementById('end-hour-field');
    const hourHeightField = this.shadowRoot.getElementById('hour-height-field');

    // Set values
    if (titleField) {
      titleField.value = this._config.title || '';
      titleField.addEventListener('input', this._valueChanged.bind(this));
    }

    // Render the list of selected entities
    if (entitiesList) {
      this._renderEntitiesList(entitiesList);
    }

    // Setup the entity picker for adding new entities
    if (addEntityPicker && this._hass) {
      addEntityPicker.hass = this._hass;
      addEntityPicker.includeDomains = ['calendar'];
      addEntityPicker.value = ''; // Always start empty

      addEntityPicker.addEventListener('value-changed', (ev) => {
        const newEntity = ev.detail.value;
        // Check if entity already exists (comparing entity IDs)
        const alreadyExists = this._config.entities.some(e => e.entity === newEntity);

        if (newEntity && !alreadyExists) {
          // Add the new entity as an object with null name/color (will use defaults)
          this._config = {
            ...this._config,
            entities: [...this._config.entities, { entity: newEntity, name: null, color: null }]
          };
          this._fireConfigChanged();

          // Clear the picker and re-render
          addEntityPicker.value = '';
          this._renderEntitiesList(entitiesList);
        }
      });
    }

    if (startHourField) {
      startHourField.value = this._config.start_hour;
      startHourField.addEventListener('input', this._valueChanged.bind(this));
    }

    if (endHourField) {
      endHourField.value = this._config.end_hour;
      endHourField.addEventListener('input', this._valueChanged.bind(this));
    }

    if (hourHeightField) {
      hourHeightField.value = this._config.hour_height;
      hourHeightField.addEventListener('input', this._valueChanged.bind(this));
    }

    // Time format select
    const timeFormatField = this.shadowRoot.getElementById('time-format-field');
    if (timeFormatField) {
      timeFormatField.value = this._config.time_format || '24h';
      timeFormatField.addEventListener('change', this._valueChanged.bind(this));
    }

    // Show all-day events checkbox
    const showAllDayField = this.shadowRoot.getElementById('show-all-day-field');
    if (showAllDayField) {
      showAllDayField.checked = this._config.show_all_day_events !== false;
      showAllDayField.addEventListener('change', this._valueChanged.bind(this));
    }

    // Compact mode checkbox
    const compactModeField = this.shadowRoot.getElementById('compact-mode-field');
    if (compactModeField) {
      compactModeField.checked = this._config.compact_mode || false;
      compactModeField.addEventListener('change', this._valueChanged.bind(this));
    }
  }

  _renderEntitiesList(container) {
    const entities = this._config.entities || [];

    if (entities.length === 0) {
      container.innerHTML = '<div class="no-entities">No calendars selected</div>';
      return;
    }

    container.innerHTML = entities.map((entityConfig, index) => {
      const entityId = entityConfig.entity;
      const stateObj = this._hass?.states[entityId];
      const friendlyName = stateObj?.attributes?.friendly_name || entityId.replace('calendar.', '');
      const customName = entityConfig.name || '';
      const customColor = entityConfig.color || '';

      // Get default color to show as placeholder
      const defaultColor = this._getDefaultColor(index);

      return `
        <div class="entity-row" data-entity="${entityId}">
          <div class="entity-row-header">
            <span class="color-indicator" style="background-color: ${customColor || defaultColor};"></span>
            <span class="entity-name">${friendlyName}</span>
            <button class="entity-row-remove" data-entity="${entityId}" title="Remove">×</button>
          </div>
          <div class="entity-row-config">
            <div class="config-field">
              <label>Custom Name</label>
              <input
                type="text"
                class="entity-custom-name"
                data-entity="${entityId}"
                placeholder="${friendlyName}"
                value="${customName}"
              />
            </div>
            <div class="config-field">
              <label>Color</label>
              <div class="color-input-wrapper">
                <input
                  type="color"
                  class="entity-color-picker"
                  data-entity="${entityId}"
                  value="${customColor || defaultColor}"
                />
                <input
                  type="text"
                  class="entity-color-text"
                  data-entity="${entityId}"
                  placeholder="${defaultColor}"
                  value="${customColor}"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
                ${customColor ? `<button class="color-reset" data-entity="${entityId}" title="Reset to default">↺</button>` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach event handlers
    this._attachEntityListHandlers(container);
  }

  _getDefaultColor(index) {
    const colors = [
      '#4285f4', '#ea4335', '#fbbc04', '#34a853',
      '#9c27b0', '#ff6d00', '#00bcd4', '#e91e63',
    ];
    return colors[index % colors.length];
  }

  _attachEntityListHandlers(container) {
    // Remove button handlers
    container.querySelectorAll('.entity-row-remove').forEach(button => {
      button.addEventListener('click', (ev) => {
        const entityToRemove = ev.target.dataset.entity;
        this._config = {
          ...this._config,
          entities: this._config.entities.filter(e => e.entity !== entityToRemove)
        };
        this._fireConfigChanged();
        this._renderEntitiesList(container);
      });
    });

    // Custom name input handlers
    container.querySelectorAll('.entity-custom-name').forEach(input => {
      input.addEventListener('input', (ev) => {
        const entityId = ev.target.dataset.entity;
        const newName = ev.target.value.trim();
        this._updateEntityConfig(entityId, 'name', newName || null);
      });
    });

    // Color picker handlers
    container.querySelectorAll('.entity-color-picker').forEach(input => {
      input.addEventListener('input', (ev) => {
        const entityId = ev.target.dataset.entity;
        const newColor = ev.target.value;
        this._updateEntityConfig(entityId, 'color', newColor);

        // Update the text input too
        const textInput = container.querySelector(`.entity-color-text[data-entity="${entityId}"]`);
        if (textInput) textInput.value = newColor;

        // Re-render to show reset button
        this._renderEntitiesList(container);
      });
    });

    // Color text input handlers
    container.querySelectorAll('.entity-color-text').forEach(input => {
      input.addEventListener('input', (ev) => {
        const entityId = ev.target.dataset.entity;
        const newColor = ev.target.value.trim();

        // Validate hex color format
        if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
          this._updateEntityConfig(entityId, 'color', newColor);

          // Update the color picker too
          const pickerInput = container.querySelector(`.entity-color-picker[data-entity="${entityId}"]`);
          if (pickerInput) pickerInput.value = newColor;

          // Re-render to show reset button
          this._renderEntitiesList(container);
        }
      });
    });

    // Color reset button handlers
    container.querySelectorAll('.color-reset').forEach(button => {
      button.addEventListener('click', (ev) => {
        const entityId = ev.target.dataset.entity;
        this._updateEntityConfig(entityId, 'color', null);
        this._renderEntitiesList(container);
      });
    });
  }

  _updateEntityConfig(entityId, field, value) {
    const entities = this._config.entities.map(e => {
      if (e.entity === entityId) {
        return { ...e, [field]: value };
      }
      return e;
    });

    this._config = {
      ...this._config,
      entities: entities
    };

    // Debounce the config-changed event
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
    }

    this._debounceTimeout = setTimeout(() => {
      this._fireConfigChanged();
    }, 300);
  }
}

customElements.define('calendar-column-view-card', CalendarColumnViewCard);
customElements.define('calendar-column-view-card-editor', CalendarColumnViewCardEditor);

// Register the card with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'calendar-column-view-card',
  name: 'Calendar Column View',
  description: 'Display multiple calendars in columns with hourly rows',
});

console.info(
  '%c CALENDAR-COLUMN-VIEW-CARD %c 0.2.0 ',
  'color: white; background: #4285f4; font-weight: 700;',
  'color: #4285f4; background: white; font-weight: 700;'
);
