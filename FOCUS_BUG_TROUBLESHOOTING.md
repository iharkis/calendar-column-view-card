# Focus Loss Bug - Troubleshooting Log

## Problem Description
When editing the card configuration in the UI, all input fields lose focus after each keystroke. For example, trying to type "45" in the hour_height field results in:
- Type "4" → field loses focus
- Must click field again
- Type "5" → field loses focus again

This makes the configuration editor unusable for multi-digit input.

## Root Cause Analysis
The card editor is experiencing constant re-renders, which destroys and recreates the DOM elements (including input fields), causing focus loss.

**Key observation**: Network tab shows "constantly streaming strategy handler" when the editor is open, indicating Home Assistant is repeatedly calling `setConfig()` or setting the `hass` property.

## Attempted Fixes

### Attempt 1: `_isEditing` Flag (FAILED)
**Approach**: Track when a field has focus and prevent re-rendering during editing.

**Implementation**:
```javascript
class CalendarColumnViewCardEditor extends HTMLElement {
  constructor() {
    this._isEditing = false;
  }

  setConfig(config) {
    this._config = { ...config };
    if (!this._isEditing) {
      this.render();
    }
  }

  _attachEditorComponents() {
    titleField.addEventListener('focus', () => { this._isEditing = true; });
    titleField.addEventListener('blur', () => { this._isEditing = false; });
    // ... same for all fields
  }
}
```

**Result**: FAILED - Focus still lost
**Reason**: `ha-textfield` web components may not fire focus/blur events as expected, or HA is calling setConfig before the focus event fires.

---

### Attempt 2: Update Values Without Re-rendering (PARTIAL)
**Approach**: Check if the editor DOM already exists, and if so, just update field values without destroying/recreating the DOM.

**Implementation**:
```javascript
setConfig(config) {
  this._config = { ...config };

  // If editor already exists, just update values
  if (this.shadowRoot && this.shadowRoot.querySelector('.editor-container')) {
    this._updateFieldValues();
  } else {
    this.render(); // First time only
  }
}

_updateFieldValues() {
  const titleField = this.shadowRoot.getElementById('title-field');
  const startHourField = this.shadowRoot.getElementById('start-hour-field');
  // ... etc

  // Only update if value actually changed
  if (titleField && titleField.value !== this._config.title) {
    titleField.value = this._config.title || '';
  }
  if (startHourField && Number(startHourField.value) !== this._config.start_hour) {
    startHourField.value = this._config.start_hour;
  }
  // ... etc
}
```

**Result**: FAILED - Focus still lost
**Reason**: `setConfig()` is being called repeatedly even when nothing changed, causing `_updateFieldValues()` to run and potentially interfere with focus.

---

### Attempt 3: Config Comparison Guard (CURRENT - TESTING)
**Approach**: Compare the new config with the old config before doing anything. Exit immediately if nothing changed.

**Implementation**:
```javascript
setConfig(config) {
  const newConfig = {
    entities: config.entities || [],
    start_hour: config.start_hour !== undefined ? config.start_hour : 6,
    end_hour: config.end_hour !== undefined ? config.end_hour : 22,
    title: config.title || 'Calendar View',
    hour_height: config.hour_height || 60,
  };

  // Exit early if config hasn't actually changed
  if (this._config && this._configsEqual(this._config, newConfig)) {
    console.log('[Calendar Editor] Config unchanged, skipping render');
    return;
  }

  console.log('[Calendar Editor] Config changed, updating editor');
  this._config = newConfig;

  // Update values or render
  if (this.shadowRoot && this.shadowRoot.querySelector('.editor-container')) {
    console.log('[Calendar Editor] Updating field values only');
    this._updateFieldValues();
  } else {
    console.log('[Calendar Editor] Full render (first time)');
    this.render();
  }
}

_configsEqual(config1, config2) {
  if (config1.title !== config2.title) return false;
  if (config1.start_hour !== config2.start_hour) return false;
  if (config1.end_hour !== config2.end_hour) return false;
  if (config1.hour_height !== config2.hour_height) return false;

  if (config1.entities.length !== config2.entities.length) return false;
  for (let i = 0; i < config1.entities.length; i++) {
    if (config1.entities[i] !== config2.entities[i]) return false;
  }

  return true;
}
```

**Additional change**: Added guard to `hass` setter to prevent unnecessary updates:
```javascript
set hass(hass) {
  this._hass = hass;
  if (!this._config) return;

  const addEntityPicker = this.shadowRoot?.getElementById('add-entity-picker');
  if (addEntityPicker && addEntityPicker.hass !== hass) {
    addEntityPicker.hass = hass;
  }
}
```

**Status**: ⏳ TESTING - User needs to restart HA and test
**Expected result**: Console should show "Config unchanged, skipping render" on subsequent calls, preventing focus loss.

---

## Testing Instructions

### After Restart
1. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Open browser DevTools (F12)
3. Go to Console tab
4. Open card editor
5. Try typing "45" in Hour Height field
6. Watch console logs

### What to Look For

**✅ Good signs:**
- Lots of `"[Calendar Editor] Config unchanged, skipping render"` messages
- Focus is maintained when typing
- No constant streaming in Network tab

**❌ Bad signs:**
- Repeated `"[Calendar Editor] Config changed, updating editor"` messages
- Still losing focus
- Constant streaming continues

**If still failing, check:**
- What value is changing that triggers the "config changed" message?
- Is `_fireConfigChanged()` being called on every keystroke?
- Is Home Assistant's parent dialog/modal re-rendering the editor?

---

## Possible Next Steps (If Current Fix Fails)

### Option 4: Debounce Config Changes
Delay firing `config-changed` event until user stops typing:
```javascript
_valueChanged(ev) {
  // Clear existing timeout
  clearTimeout(this._debounceTimeout);

  // Update internal config immediately
  this._config[configPath] = value;

  // Delay firing event
  this._debounceTimeout = setTimeout(() => {
    this._fireConfigChanged();
  }, 500); // Wait 500ms after last keystroke
}
```

### Option 5: Use Shadow DOM Cloning
Instead of re-rendering, clone and update nodes:
```javascript
_updateFieldValues() {
  // Don't touch fields that have focus
  const activeElement = this.shadowRoot.activeElement;

  // Update only non-focused fields
  if (titleField !== activeElement) {
    titleField.value = this._config.title;
  }
  // etc...
}
```

### Option 6: Event.stopPropagation() on Input
Prevent the input event from bubbling up:
```javascript
titleField.addEventListener('input', (ev) => {
  ev.stopPropagation();
  this._valueChanged(ev);
});
```

### Option 7: Check HA's Editor Lifecycle
Look at how other custom cards handle this:
- Check atomic-calendar-revive editor implementation
- Check button-card editor implementation
- Look for HA best practices on custom card editors

---

## File Locations
- **Current working file**: `/config/custom_components/calendar_column_view/www/calendar-column-view-card.js`
- **GitHub repo**: https://github.com/iharkis/calendar-column-view-card
- **Current version**: v0.1.1 (with incomplete fix)
- **MD5 checksum**: `4f04d7d97e744be620e966d75a0d6fb2`

---

## Questions to Answer After Testing

1. Do the console logs show "Config unchanged, skipping render"?
2. If showing "Config changed", what field is actually changing?
3. Does the Network tab still show constant streaming?
4. Is the `hass` setter being called repeatedly?
5. Does typing in any field work, or just certain fields fail?

---

## Notes
- The card itself (non-editor view) works perfectly - no issues there
- Problem is ONLY in the configuration editor UI
- Affects all input fields: title, start_hour, end_hour, hour_height
- Entity picker and remove buttons work fine (no typing involved)
