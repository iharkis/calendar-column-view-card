# Current Fix Summary

**Date**: 2025-10-27
**Status**: Testing Attempt #4 - Debounced Config Changes + Focus Detection
**File**: `/config/custom_components/calendar_column_view/www/calendar-column-view-card.js`

---

## Problem Analysis

Previous fix (Attempt #3) using config comparison was not sufficient. The issue is that firing `config-changed` events on **every keystroke** causes Home Assistant to interfere with input focus, even if our `setConfig()` exits early.

## Root Cause

1. User types "4" → `_valueChanged()` fires
2. `_fireConfigChanged()` immediately dispatches event to Home Assistant
3. **Home Assistant receives event and does "something"** (updates preview, refreshes dialog, etc.)
4. This "something" interferes with the input field focus
5. User loses focus before they can type "5"

## New Solution: Debouncing + Focus Protection

This fix implements TWO layers of protection:

### Layer 1: Debounce Config Changes (300ms delay)

**Location**: `_valueChanged()` method, lines 885-934

Instead of firing `config-changed` immediately on every keystroke, we now:
1. Update internal `_config` immediately (so UI feels responsive)
2. **Debounce** the `config-changed` event (wait 300ms after last keystroke)
3. Only notify Home Assistant after user stops typing

```javascript
_valueChanged(ev) {
  // ... get value ...

  // Update config immediately (internal state)
  this._config = {
    ...this._config,
    [configPath]: value,
  };

  // Clear any pending timeout
  if (this._debounceTimeout) {
    clearTimeout(this._debounceTimeout);
  }

  // Wait 300ms after last keystroke before notifying HA
  this._debounceTimeout = setTimeout(() => {
    console.log(`[Calendar Editor] Debounced: Firing config-changed for ${configPath}`);
    this._fireConfigChanged();
  }, 300);
}
```

**Result**: When user types "45":
- Types "4" → internal config updated, 300ms timer starts
- Types "5" → timer resets, 300ms starts again
- User stops typing → after 300ms, HA is notified with value "45"
- **Focus maintained throughout typing!**

### Layer 2: Focus Detection in `_updateFieldValues()`

**Location**: `_updateFieldValues()` method, lines 847-885

Even if `setConfig()` is called while user is typing, we now check if a field is focused before updating it:

```javascript
_updateFieldValues() {
  // Get the currently focused element (could be inner input of ha-textfield)
  const activeElement = this.shadowRoot.activeElement;
  const focusedField = activeElement?.shadowRoot?.activeElement || activeElement;

  // Only update if field is NOT focused
  if (titleField && titleField !== activeElement && titleField !== focusedField) {
    if (titleField.value !== this._config.title) {
      titleField.value = this._config.title || '';
    }
  }
  // ... same for other fields ...
}
```

**Result**: If HA calls `setConfig()` while user is typing, the focused field is **never touched**.

### Layer 3: Cleanup (Memory Leak Prevention)

**Location**: `disconnectedCallback()` method, lines 795-800

```javascript
disconnectedCallback() {
  // Clean up debounce timeout to prevent memory leaks
  if (this._debounceTimeout) {
    clearTimeout(this._debounceTimeout);
  }
}
```

---

## Why This Should Work

### The Debouncing Solution
- **Problem**: Firing config-changed on every keystroke causes HA to interfere
- **Solution**: Don't fire until user stops typing (300ms delay)
- **Benefit**: HA never receives events during rapid typing

### The Focus Detection Solution
- **Problem**: If HA does call setConfig during typing, updating the field value loses focus
- **Solution**: Skip updating fields that are currently focused
- **Benefit**: Even if HA interferes, focused fields are protected

### Combined Effect
These two layers work together:
1. Debouncing prevents most interference (primary defense)
2. Focus detection handles edge cases (secondary defense)
3. Result: **Focus is always maintained**

---

## Testing Instructions

### 1. Restart Home Assistant
```bash
ha core restart
```

### 2. Hard Refresh Browser
- Press **Ctrl+Shift+R** (or **Cmd+Shift+R** on Mac)
- This clears the browser cache and loads the new JavaScript

### 3. Open Browser Console
- Press **F12**
- Go to **Console** tab

### 4. Test Typing
1. Go to Settings → Dashboards → find your calendar card
2. Click the edit (pencil) icon to open the card editor
3. Try typing "45" in the "Hour Height" field
4. Try typing "Test Title" in the "Card Title" field

### 5. Watch Console Logs

**✅ Expected Good Behavior:**
```
Updating config hour_height to: 4
Updating config hour_height to: 5
[Calendar Editor] Debounced: Firing config-changed for hour_height
[Calendar Editor] Config changed, updating editor
[Calendar Editor] Updating field values only
```

**Key observations:**
- You should see multiple "Updating config" messages as you type
- But only ONE "Debounced: Firing config-changed" message (after you stop typing)
- Focus should be maintained throughout typing

**❌ If Still Failing:**
- Check if you're seeing "Debounced" messages (proves debouncing is working)
- Check Network tab - is there still constant streaming?
- Try increasing debounce delay from 300ms to 500ms or 1000ms

---

## Comparison with Previous Attempts

| Attempt | Approach | Why it Failed | Current Status |
|---------|----------|---------------|----------------|
| #1 | `_isEditing` flag | Focus/blur events didn't fire properly | ❌ Failed |
| #2 | Update values only | Still called on every setConfig | ❌ Failed |
| #3 | Config comparison guard | Still fired config-changed on every keystroke | ❌ Failed |
| **#4** | **Debouncing + Focus detection** | **Should prevent both causes** | ⏳ Testing |

---

## Technical Details

### Debounce Timeout
- **Delay**: 300ms (configurable)
- **Type**: Trailing debounce (fires after last keystroke)
- **Cleanup**: Cleared in `disconnectedCallback()`

### Focus Detection
- **Checks**: Both `activeElement` and nested `shadowRoot.activeElement`
- **Reason**: `ha-textfield` has a shadow DOM with an inner `<input>`
- **Fallback**: If detection fails, config comparison still protects us

### Config Comparison (Still Active)
The previous fix (Attempt #3) is still in place as an additional layer:
- `_configsEqual()` prevents unnecessary updates
- Early exit in `setConfig()` if config unchanged
- Works together with new debouncing

---

## File Checksums

After saving, verify the file:
```bash
md5sum /config/custom_components/calendar_column_view/www/calendar-column-view-card.js
```

Expected: Will be different from previous attempts (new code added)

---

## Success Criteria

✅ **Fix is successful if:**
1. Can type "45" without losing focus after "4"
2. Can type "Test Title" without losing focus
3. Console shows debounced messages (not immediate)
4. No focus loss during rapid typing
5. Config is still saved correctly after typing stops

❌ **Fix failed if:**
1. Still losing focus on every keystroke
2. Console shows immediate "Firing config-changed" (no debounce)
3. Can't type multi-character values

---

## Rollback Plan (If This Fails)

If this fix doesn't work, the next approach would be:

### Option A: Increase Debounce Delay
Change 300ms to 1000ms (1 second) to give more buffer time.

### Option B: Use Form-Based Config
Instead of updating on every input event, use a form with a "Save" button. Only fire `config-changed` when user clicks Save.

### Option C: Study Other Custom Cards
Look at how successful custom cards (like `button-card` or `atomic-calendar-revive`) handle editor focus.

---

## What Changed in This Update

### Files Modified
- ✅ `/config/custom_components/calendar_column_view/www/calendar-column-view-card.js`
  - Added debouncing in `_valueChanged()` (lines ~923-933)
  - Added focus detection in `_updateFieldValues()` (lines ~855-879)
  - Added `disconnectedCallback()` for cleanup (lines ~795-800)

### Files Created/Updated
- ✅ `/config/custom_components/calendar_column_view/CURRENT_FIX_SUMMARY.md` (this file)
- ✅ `/config/custom_components/calendar_column_view/FOCUS_BUG_TROUBLESHOOTING.md` (from previous attempt)

---

## Next Steps

1. ✅ Code changes complete
2. ⏳ User needs to restart HA
3. ⏳ User needs to test typing in editor
4. ⏳ User reports results
5. ⏳ If successful: commit to git and push to GitHub
6. ⏳ If failed: analyze console logs and try next approach

---

**Status**: ⏳ **AWAITING USER TESTING**

Please restart Home Assistant, hard refresh your browser, and test typing in the card editor!
