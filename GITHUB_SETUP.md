# GitHub Repository Setup Guide

This guide explains how to set up your GitHub repository for HACS compatibility.

## Repository Structure

Your GitHub repository should have this structure:

```
calendar-column-view-card/
├── calendar-column-view-card.js  ← Your main card file
├── README.md                      ← Installation and usage docs
├── hacs.json                      ← HACS configuration
├── LICENSE                        ← MIT License
└── info.md                        ← HACS display info (optional)
```

## Files to Copy

Copy these files from `/config/custom_components/calendar_column_view/` to your GitHub repo:

1. **calendar-column-view-card.js** (from `www/` subdirectory) → **root of repo**
2. **README.md** → root of repo
3. **hacs.json** → root of repo
4. **LICENSE** → root of repo
5. **info.md** → root of repo

**Important:** The JavaScript file must be at the **root** of the repository, NOT in a subdirectory.

## Files NOT to Copy

Do NOT copy these integration-specific files (not needed for frontend card):
- ❌ `__init__.py`
- ❌ `const.py`
- ❌ `manifest.json`
- ❌ `example-card-config.yaml`
- ❌ `__pycache__/`

## Before Pushing to GitHub

1. **Update placeholder URLs in README.md:**
   - Replace `yourusername` with your actual GitHub username
   - Replace repository name if different

2. **Update badge URLs** (lines 3-5 in README.md):
   ```markdown
   [![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/custom-components/hacs)
   [![GitHub Release](https://img.shields.io/github/release/YOUR_USERNAME/calendar-column-view-card.svg)](https://github.com/YOUR_USERNAME/calendar-column-view-card/releases)
   [![License](https://img.shields.io/github/license/YOUR_USERNAME/calendar-column-view-card.svg)](LICENSE)
   ```

3. **Update copyright year in LICENSE** if needed (currently 2025)

## GitHub Setup Steps

1. **Create new GitHub repository:**
   ```bash
   # On GitHub, create a new repo named: calendar-column-view-card
   # Don't initialize with README (we have our own)
   ```

2. **Initialize local git repo:**
   ```bash
   cd /path/to/repo
   git init
   git add .
   git commit -m "Initial commit: Calendar Column View Card v0.1.0"
   ```

3. **Push to GitHub:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/calendar-column-view-card.git
   git branch -M main
   git push -u origin main
   ```

4. **Create release tag:**
   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0 - Initial release"
   git push origin v0.1.0
   ```

5. **Create GitHub Release** (optional but recommended):
   - Go to your repo → Releases → "Create a new release"
   - Choose tag: v0.1.0
   - Release title: "v0.1.0 - Initial Release"
   - Add release notes describing features
   - Attach `calendar-column-view-card.js` as a release asset

## Adding to HACS (Private Testing)

1. **In Home Assistant:**
   - Go to HACS → Frontend
   - Click 3-dot menu (⋮) → Custom repositories
   - Add repository URL: `https://github.com/YOUR_USERNAME/calendar-column-view-card`
   - Category: **Lovelace**
   - Click "Add"

2. **Install the card:**
   - Search for "Calendar Column View Card" in HACS Frontend
   - Click "Download"
   - Refresh your browser (Ctrl+F5)

3. **Test the card:**
   - Add to a dashboard using the card configurator
   - Verify it loads and displays calendars correctly

## Updating the Card

When you make changes:

1. **Update version** if making significant changes:
   - Update version in README.md (line 207)
   - Increment version in commit message

2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Fix: description of fix"
   git push
   ```

3. **Create new tag** (for major updates):
   ```bash
   git tag -a v0.1.1 -m "Release v0.1.1 - Bug fixes"
   git push origin v0.1.1
   ```

4. **Update in HACS:**
   - HACS will detect the new version
   - Users can click "Update" to get latest version

## Future: Submitting to Default HACS

Once you've tested privately and are happy with the card:

1. Submit PR to: https://github.com/hacs/default
2. Add your repository to the `data` directory
3. HACS team will review and merge
4. Card becomes available to all HACS users!

## Need Help?

- HACS Documentation: https://hacs.xyz/docs/publish/start
- HACS Discord: https://discord.gg/apgchf8
