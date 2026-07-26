# Temporary export — delete after migration

`grants-scholarship/` is the complete standalone Opportunity Radar app,
ready to become the root of https://github.com/naviyaissocodelike/grants-scholarship.

To migrate, either ask Claude Code (in a session with the grants-scholarship
repo) to import this folder, or locally:

```bash
git clone https://github.com/naviyaissocodelike/voice-to-insight.git tmp-vi
git clone https://github.com/naviyaissocodelike/grants-scholarship.git
cp -r tmp-vi/_export/grants-scholarship/. grants-scholarship/
cd grants-scholarship && git add -A && git commit -m "Import Opportunity Radar" && git push
```

Then delete this `_export/` folder from voice-to-insight.
