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
  }

  setConfig(config) {
    if (!config.entities || !Array.isArray(config.entities) || config.entities.length === 0) {
      throw new Error('You must define at least one calendar entity');
    }

    this.config = {
      entities: config.entities,
      start_hour: config.start_hour !== undefined ? config.start_hour : 6,
      end_hour: config.end_hour !== undefined ? config.end_hour : 22,
      title: config.title || 'Calendar View',
      hour_height: config.hour_height || 60,
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

    this.render();
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

      for (const entityId of this.config.entities) {
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
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  _getCalendarColor(entityId, index) {
    // Try to use calendar's configured color first
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

      group.forEach((event, index) => {
        layouts.push({
          event: event,
          width: `${width}%`,
          left: `${width * index}%`,
        });
      });
    }

    return layouts;
  }

  _renderAllDayEvents(entityId, color) {
    const events = this._events[entityId] || [];

    // Filter all-day events (events with just date, not dateTime)
    const allDayEvents = events.filter(event =>
      (event.start && event.start.date && !event.start.dateTime) ||
      (event.start && event.start.dateTime && event.end && event.end.dateTime &&
       new Date(event.end.dateTime) - new Date(event.start.dateTime) >= 86400000)
    );

    return allDayEvents.map(event => {
      const title = event.summary || 'Untitled Event';
      return `
        <div class="all-day-event" style="background-color: ${color}; border-left: 3px solid ${this._adjustColor(color, -20)};">
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

      const timeStr = startTime.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const title = event.summary || 'Untitled Event';

      return `
        <div class="event"
             style="
               top: ${top}px;
               height: ${height}px;
               background-color: ${color};
               border-left: 3px solid ${this._adjustColor(color, -20)};
             "
             title="${title}${event.location ? '\n' + event.location : ''}">
          <div class="event-time">${timeStr}</div>
          <div class="event-title">${title}</div>
          ${event.location ? `<div class="event-location">${event.location}</div>` : ''}
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
    if (this._hass && this._hass.states[entityId]) {
      const stateObj = this._hass.states[entityId];
      return stateObj.attributes.friendly_name || entityId.replace('calendar.', '');
    }
    return entityId.replace('calendar.', '');
  }

  render() {
    if (!this.config) return;

    const hours = [];
    for (let h = this.config.start_hour; h <= this.config.end_hour; h++) {
      hours.push(h);
    }

    const totalHeight = (this.config.end_hour - this.config.start_hour) * this.config.hour_height;

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
              ${this.config.entities.map((entityId, index) => {
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
              <div class="grid-cell-allday time-col">All Day</div>
              ${this.config.entities.map((entityId, index) => {
                const color = this._getCalendarColor(entityId, index);
                return `
                  <div class="grid-cell-allday">
                    ${this._renderAllDayEvents(entityId, color)}
                  </div>
                `;
              }).join('')}

              <!-- Hour rows -->
              ${hours.map(hour => `
                <div class="grid-cell-hour time-col">${this._formatTime(hour)}</div>
                ${this.config.entities.map((entityId, index) => {
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
    this._isEditing = false; // Flag to prevent re-render during user input
  }

  connectedCallback() {
    this.loadCustomElements();
  }

  async loadCustomElements() {
    // Load ha-entity-picker and other HA components
    if (!customElements.get('ha-entity-picker')) {
      await customElements.get('hui-entities-card')?.getConfigElement();
    }
  }

  setConfig(config) {
    this._config = {
      ...config, // Preserve all original config including type
      entities: config.entities || [],
      start_hour: config.start_hour !== undefined ? config.start_hour : 6,
      end_hour: config.end_hour !== undefined ? config.end_hour : 22,
      title: config.title || 'Calendar View',
      hour_height: config.hour_height || 60,
    };
    // Only render if we're not currently editing (prevents focus loss)
    if (!this._isEditing) {
      this.render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    // Update ha-entity-picker with hass
    const addEntityPicker = this.shadowRoot?.getElementById('add-entity-picker');
    if (addEntityPicker) {
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
    if (ev.detail && ev.detail.value !== undefined) {
      // ha-entity-picker and other HA components use detail.value
      value = ev.detail.value;
    } else if (target.value !== undefined) {
      // ha-textfield and regular inputs
      if (target.type === 'number') {
        value = Number(target.value);
      } else {
        value = target.value;
      }
    } else if (target.type === 'checkbox') {
      value = target.checked;
    } else {
      return;
    }

    console.log(`Updating config ${configPath} to:`, value);

    // Set config value
    this._config = {
      ...this._config,
      [configPath]: value,
    };

    this._fireConfigChanged();
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
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
          min-height: 20px;
        }

        .entity-chip {
          display: inline-flex;
          align-items: center;
          padding: 4px 12px;
          background: var(--primary-color);
          color: var(--text-primary-color, white);
          border-radius: 16px;
          font-size: 14px;
          gap: 8px;
        }

        .entity-chip-remove {
          cursor: pointer;
          padding: 0 4px;
          margin: 0;
          background: none;
          border: none;
          color: inherit;
          font-size: 18px;
          line-height: 1;
          opacity: 0.8;
        }

        .entity-chip-remove:hover {
          opacity: 1;
        }

        .no-entities {
          color: var(--secondary-text-color);
          font-style: italic;
          font-size: 14px;
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
      titleField.addEventListener('focus', () => { this._isEditing = true; });
      titleField.addEventListener('blur', () => { this._isEditing = false; });
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
        if (newEntity && !this._config.entities.includes(newEntity)) {
          // Add the new entity to the list
          this._config = {
            ...this._config,
            entities: [...this._config.entities, newEntity]
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
      startHourField.addEventListener('focus', () => { this._isEditing = true; });
      startHourField.addEventListener('blur', () => { this._isEditing = false; });
      startHourField.addEventListener('input', this._valueChanged.bind(this));
    }

    if (endHourField) {
      endHourField.value = this._config.end_hour;
      endHourField.addEventListener('focus', () => { this._isEditing = true; });
      endHourField.addEventListener('blur', () => { this._isEditing = false; });
      endHourField.addEventListener('input', this._valueChanged.bind(this));
    }

    if (hourHeightField) {
      hourHeightField.value = this._config.hour_height;
      hourHeightField.addEventListener('focus', () => { this._isEditing = true; });
      hourHeightField.addEventListener('blur', () => { this._isEditing = false; });
      hourHeightField.addEventListener('input', this._valueChanged.bind(this));
    }
  }

  _renderEntitiesList(container) {
    const entities = this._config.entities || [];

    if (entities.length === 0) {
      container.innerHTML = '<div class="no-entities">No calendars selected</div>';
      return;
    }

    container.innerHTML = entities.map(entityId => {
      const stateObj = this._hass?.states[entityId];
      const friendlyName = stateObj?.attributes?.friendly_name || entityId;

      return `
        <div class="entity-chip">
          <span>${friendlyName}</span>
          <button class="entity-chip-remove" data-entity="${entityId}" title="Remove">×</button>
        </div>
      `;
    }).join('');

    // Attach remove handlers
    container.querySelectorAll('.entity-chip-remove').forEach(button => {
      button.addEventListener('click', (ev) => {
        const entityToRemove = ev.target.dataset.entity;
        this._config = {
          ...this._config,
          entities: this._config.entities.filter(e => e !== entityToRemove)
        };
        this._fireConfigChanged();
        this._renderEntitiesList(container);
      });
    });
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
  '%c CALENDAR-COLUMN-VIEW-CARD %c 0.1.1 ',
  'color: white; background: #4285f4; font-weight: 700;',
  'color: #4285f4; background: white; font-weight: 700;'
);
