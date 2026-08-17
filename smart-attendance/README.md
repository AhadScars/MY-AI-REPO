# Smart Attendance System — Face Recognition (Pro)

Desktop attendance with **check-in / check-out**, **On-Time / Late / Absent**, face snapshots, student profiles, admin PIN, and notepad + JSON logs.

## Features

| Feature | Description |
|--------|-------------|
| **Check-In / Check-Out** | Session mode switch; face marks In or Out |
| **On-Time / Late** | Check-in before `09:15:00` = On-Time; after = Late (editable in `config.py`) |
| **Absent** | Admin: mark remaining students absent for a day |
| **Browse past days** | Archive viewer + manual fixes |
| **Manual entry / fix** | Correct times, status, or delete mistakes (PIN) |
| **Student metadata** | ID, class, roll, phone, email, notes |
| **Snapshot on mark** | Saves JPEG under `snapshots/YYYY-MM-DD/` |
| **History per person** | Full attendance history dialog |
| **Update face samples** | Re-capture and retrain one person |
| **Admin PIN** | Default `1234` — change in app |
| **Mark visuals** | **Green flash** = just marked · **Gray** = already marked |

## Run (Windows)

```bat
cd smart-attendance
pip install -r requirements.txt
python main.py
```

Or double-click `run.bat`.

## Quick workflow

1. **Register Face** (PIN) → capture samples → model trains  
2. **Profile** → fill student metadata  
3. Set **Check-In** → **Start Live Session** → face camera  
4. Later set **Check-Out** → start session again  
5. End of day: **Mark Remaining Absent** (PIN)  
6. **Browse Past Days** / **Manual Entry** to fix mistakes  
7. **Open Today's Notepad** for the `.txt` sheet  

## Schedule (`config.py`)

```python
ON_TIME_UNTIL = "09:15:00"   # check-in by this time = On-Time
LATE_UNTIL    = "12:00:00"
DEFAULT_ADMIN_PIN = "1234"
```

## Data layout

```
smart-attendance/
├── main.py / dialogs.py / face_engine.py
├── attendance_logger.py / students.py / admin_auth.py
├── known_faces/           # face samples
├── trainer/face_model.yml
├── data/
│   ├── labels.json
│   ├── students.json      # metadata
│   └── admin.json         # PIN hash
├── attendance_records/
│   ├── attendance_YYYY-MM-DD.json
│   └── attendance_YYYY-MM-DD.txt   # notepad
└── snapshots/YYYY-MM-DD/  # check-in/out photos
```

## Visual legend (live camera)

- **Green flash (3s)** — just checked in/out  
- **Gray box** — already completed that action  
- **Amber** — check-out attempted without check-in  
- **Red** — unknown face  

## Requirements

- Python 3.10+
- Webcam
- `opencv-contrib-python`, `numpy`, `Pillow`
