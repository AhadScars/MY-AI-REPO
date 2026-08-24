# Rail Enquiry

A basic **Spot Your Train** page inspired by [NTES](https://enquiry.indianrail.gov.in/mntes/).

Type a train number or name, pick a start date, and fetch live running status, schedule, or trains between two stations.

This is an unofficial demo. It is not the Indian Railways / CRIS website.

## Run

```bash
cd train-enquiry
python3 -m http.server 8080
```

Then open http://localhost:8080

Windows:

```bat
run.bat
```

## What it fetches

| Page | What you enter | What you get |
| --- | --- | --- |
| Spot Your Train | Train number or name + start date | Live map location, station-by-station status, delay, platform |
| Train Schedule | Train number or name | Timetable, running days, distance |
| Trains Between Stations | Station codes (NDLS, HWH, CSMT…) | Direct trains, dep/arr, duration |

Data comes from the public TrainTrack API (`traintrack.stupidlabs.lol`). Confirm important journeys on official NTES / RailOne.
