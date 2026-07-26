# Temporary export — delete after applying

`grants-scholarship/` is the updated Opportunity Radar app (now on Google
Gemini's FREE tier instead of the paid Anthropic API).

To apply, same as last time:

```bash
git clone -b claude/gracious-albattani-956yhx https://github.com/naviyaissocodelike/voice-to-insight.git tmp-vi
git clone https://github.com/naviyaissocodelike/grants-scholarship.git
cp -r tmp-vi/_export/grants-scholarship/. grants-scholarship/
cd grants-scholarship && git add -A && git commit -m "Switch to free Gemini model" && git push
```

Repo secret change: add GEMINI_API_KEY (free at https://aistudio.google.com/apikey);
ANTHROPIC_API_KEY is no longer used and can be deleted.
