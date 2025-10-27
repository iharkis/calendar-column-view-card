================================================================================
  QUICK START AFTER RESTART - Focus Loss Bug Fix Testing
================================================================================

1. VERIFY FILE IS UPDATED
   md5sum /config/custom_components/calendar_column_view/www/calendar-column-view-card.js
   Expected: 4f04d7d97e744be620e966d75a0d6fb2

2. CLEAR BROWSER CACHE
   - Chrome/Edge/Firefox: Ctrl+Shift+R (or Cmd+Shift+R on Mac)

3. OPEN BROWSER DEVTOOLS
   - Press F12
   - Go to Console tab

4. TEST THE EDITOR
   - Open dashboard with calendar card
   - Click edit on card
   - Try typing "45" in Hour Height field
   - Watch console for these messages:
     ✅ "[Calendar Editor] Config unchanged, skipping render" = GOOD
     ❌ "[Calendar Editor] Config changed, updating editor" repeatedly = BAD

5. REPORT RESULTS
   - Can you type "45" without losing focus?
   - What messages appear in console?
   - Does Network tab still show streaming?

6. READ FULL DOCS
   See these files for details:
   - TESTING_CHECKLIST.md - Step by step testing guide
   - CURRENT_FIX_SUMMARY.md - What code changed and why
   - FOCUS_BUG_TROUBLESHOOTING.md - Complete history of all attempts

================================================================================
Current Fix: Config comparison guard (Attempt #3)
Status: Testing - results unknown
================================================================================
