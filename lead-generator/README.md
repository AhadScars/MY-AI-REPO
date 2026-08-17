# Lead Generator

Finds local businesses that **do not have their own website**, saves them, and exports Excel.

This is the automation around the New York dental-clinic list. It works for dentists first, and also for plumbers, lawyers, salons, and other local industries.

## What it does

1. Pulls named businesses from OpenStreetMap for a city
2. Checks each one for an official website (Yelp / Zocdoc / Healthgrades do **not** count)
3. Saves leads in a local database
4. Lets you mark contacted / interested
5. Exports a call-ready Excel file
6. Can repeat a search every 1 / 7 / 14 / 30 days while the app is open

Your first 23 verified New York dental offices are loaded automatically.

## Run the dashboard

**Windows:** double-click `run.bat`

**Or in a terminal:**

```bash
cd lead-generator
pip install -r requirements.txt
python app.py
```

Then open **http://127.0.0.1:5055**

## Run a search from the terminal

```bash
python app.py search --niche dentist --location "Brooklyn, NY" --max 40 --export
```

Other industries: `plumber`, `electrician`, `hvac`, `roofer`, `lawyer`, `accountant`, `real_estate`, `hairdresser`, `auto_repair`, `veterinarian`, `chiropractor`, `restaurant`, `bakery`, `florist`, `gym`

Export whatever is already saved:

```bash
python app.py export
```

Excel files land in `exports/`.

## Repeat automatically

In **New search**, set **Repeat automatically** to every 7 days. Leave the dashboard running (or use Windows Task Scheduler with the command below).

```bat
python app.py search --niche dentist --location "New York, NY" --every-days 7 --export
```

## Honest limits

- This is **not** every dentist in New York. Map data is incomplete.
- Search engines will slow or block website checks if you run too many at once.
- Always call before you pitch. Numbers and hours go stale.
- The app does **not** send emails or spam people. It only builds a list you control.

## Files

| Path | Role |
|---|---|
| `app.py` | Dashboard + command line |
| `engine.py` | Map search + website check |
| `data/leads.db` | Your lead database |
| `exports/` | Excel files |
