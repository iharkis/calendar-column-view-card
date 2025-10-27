# Testing Checklist - Focus Loss Bug

## Quick Reference

**File**: `/config/custom_components/calendar_column_view/www/calendar-column-view-card.js`
**MD5**: `4f04d7d97e744be620e966d75a0d6fb2`
**Current Fix**: Config comparison guard + console logging

---

## Testing Steps

### 1. Restart Home Assistant
```bash
ha core restart
```

### 2. Clear Browser Cache
- **Chrome/Edge**: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- **Firefox**: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- Or clear cache from Settings → Clear browsing data

### 3. Open Browser DevTools
- Press **F12** or right-click → Inspect
- Go to **Console** tab
- Keep it open during testing

### 4. Open Card Editor
- Go to any dashboard with the Calendar Column View Card
- Click the edit icon on the card
- The configuration editor should open

### 5. Watch Console Logs
Look for these messages:
```
[Calendar Editor] Full render (first time)
[Calendar Editor] Config unchanged, skipping render
[Calendar Editor] Config changed, updating editor
[Calendar Editor] Updating field values only
```

### 6. Test Typing
Try these scenarios:

#### Test A: Hour Height Field
- Click in "Hour Height" field
- Type "4"
- **Expected**: Field keeps focus
- Type "5" immediately after
- **Expected**: You now have "45" in the field

#### Test B: Title Field
- Click in "Card Title" field
- Type "My Calendar"
- **Expected**: Can type entire phrase without re-clicking

#### Test C: Start Hour Field
- Click in "Start Hour" field
- Type "7"
- **Expected**: Field keeps focus

#### Test D: End Hour Field
- Click in "End Hour" field
- Type "21"
- **Expected**: Can type both digits

---

## What to Report Back

### ✅ If Working:
- [ ] Can type multi-digit numbers without losing focus
- [ ] Console shows mostly "Config unchanged, skipping render"
- [ ] No constant streaming in Network tab

### ❌ If Still Broken:
Record these details:

**Console Output:**
```
[Paste relevant console logs here]
```

**Which fields fail:**
- [ ] Title field
- [ ] Start Hour field
- [ ] End Hour field
- [ ] Hour Height field
- [ ] All fields
- [ ] Random/intermittent

**Network Tab:**
- [ ] Still shows constant streaming
- [ ] Streaming stopped but focus still lost
- [ ] No streaming, no focus loss

**Frequency:**
- [ ] Loses focus on every keystroke
- [ ] Loses focus randomly
- [ ] Works for first few characters then fails

---

## Debug Commands

### Check file is loaded:
Open console and run:
```javascript
console.log(customElements.get('calendar-column-view-card-editor'));
```
Should show the class definition.

### Check current version:
Look for this in console on page load:
```
CALENDAR-COLUMN-VIEW-CARD 0.1.1
```

### Force reload resource:
Go to Settings → Dashboards → Resources and delete/re-add:
```
/hacsfiles/calendar_column_view/calendar-column-view-card.js
```

---

## Next Actions Based on Results

### If console shows "Config unchanged" but still loses focus:
→ The problem is not `setConfig()` being called
→ Try Option 5 or 6 from FOCUS_BUG_TROUBLESHOOTING.md

### If console shows "Config changed" repeatedly:
→ Something is actually changing in the config
→ Add more detailed logging to see what field is changing
→ Check if `_fireConfigChanged()` is being called on every keystroke

### If no console logs appear:
→ File not loaded / cached version still in browser
→ Hard refresh again
→ Check browser cache is actually cleared
→ Try different browser
→ Restart HA again

### If some fields work but others don't:
→ Problem might be specific to certain field types
→ Check if number fields vs text fields behave differently
→ May need field-specific handling

---

## Rollback if Needed

If this fix makes things worse, revert to original:
```bash
cd /root/calendar-column-view-card
git checkout v0.1.0 -- calendar-column-view-card.js
cp calendar-column-view-card.js /config/custom_components/calendar_column_view/www/
```

Then restart HA and clear cache again.
