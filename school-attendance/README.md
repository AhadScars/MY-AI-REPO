# School Attendance System

Multi-school QR check-in / check-out with SQLite, Excel export, and a subscription (license key) model.

## Features

- **QR scan or type student ID** → backend verifies student → marks present with **time_in**
- **Check-out / logout** → sets **time_out**
- **Excel sheet** auto-updated under `data/exports/` (also downloadable from the UI)
- **SQLite** database (`data/attendance.db`) — designed so you can later move to Mongo/cloud
- **Main Admin** panel: manage all schools, generate license keys, extend subscriptions
- **School Admin** panel: students, attendance (present/absent), check-in/out, subscription
- **QR codes** per student (payload ready for future **NFC** tags)
- Package as **Windows EXE** with PyInstaller

### Student entity

| Field        | Description                          |
|-------------|--------------------------------------|
| `student_id`| Unique ID within school              |
| `name`      | Full name                            |
| `class`     | Class / section                      |
| `time_in`   | Check-in time (today)                |
| `time_out`  | Check-out time                       |
| `is_present`| Yes / No                             |

## Demo logins

| Role        | Username     | Password |
|------------|--------------|----------|
| Main admin | `admin`      | `123`    |
| Demo school| `demoschool` | `123`    |

Demo school is pre-seeded with **960 fake students**:

- Classes **1–8**, sections **A–D** (32 groups)
- **30 students** per class-section  
- IDs like `C1A01` … `C8D30`  
- Lists sorted by class number → section → name  

## Quick start (Windows)

```bat
run.bat
```

## Quick start (Linux / WSL)

```bash
chmod +x run.sh
./run.sh
```

Then open **http://127.0.0.1:5050**

## Manual install

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

## Build EXE (Windows)

```bat
build_exe.bat
```

Output: `dist\SchoolAttendance.exe`  
On first run the EXE creates a `data\` folder beside itself (DB + Excel + QR images).

## Workflows

### Main admin

1. Login as `admin` / `123`
2. **License keys** → generate keys (days + max students)
3. Share key with a school, or open **Schools** → **Extend** days without a key
4. Enable / disable / delete schools

### School admin

1. Login as `demoschool` / `123` or **Register** a new school
2. **Students** → add ID, name, class → print/download QR
3. **QR Check-in / Out** → scan QR or type ID
4. **Attendance** → filter present/absent, export Excel
5. **Subscription** → paste license key from main admin

### Registration

- With license key → full term from key’s days  
- Without key → **7-day trial**

## QR / NFC payload

```
SA|{school_id}|{student_id}
```

Example: `SA|1|STU001`  
Plain `STU001` also works when logged into that school.  
Future NFC: write the same string to an NFC tag; the scan API already accepts it (`POST /scan/api`).

## Project layout

```
school-attendance/
  main.py                 # Entry (opens browser)
  app/
    config.py
    database.py           # SQLite
    services.py           # Students + attendance
    license_service.py    # Keys + extend
    excel_sync.py         # openpyxl export
    qr_service.py
    routes/               # Auth, super admin, school, scan
    templates/
    static/
  data/                   # Created at runtime
    attendance.db
    exports/*.xlsx
    qr_codes/*.png
```

## Later: Mongo / cloud DB

Business logic lives in `app/services.py` and `app/license_service.py` on top of `app/database.py`.  
Replace the SQLite helpers with a Mongo client while keeping the same function signatures used by the routes.

## Local time & cool-down

- All `time_in` / `time_out` values use the **PC local clock** (not UTC).
- After a check-in, the **same student cannot check in again** until the cool-down ends.
  Default: **60 minutes**. No second row is written to the database during cool-down.

Change cool-down in `app/config.py`:

```python
CHECKIN_COOLDOWN_MINUTES = 60   # e.g. 30, 15, 120
CHECKOUT_COOLDOWN_MINUTES = 60
```

Or env vars: `ATTENDANCE_CHECKIN_COOLDOWN`, `ATTENDANCE_CHECKOUT_COOLDOWN`.

## Notes

- Change default passwords and `ATTENDANCE_SECRET` before production use.
- Host/port: `ATTENDANCE_HOST`, `ATTENDANCE_PORT` (default `0.0.0.0:5050`).
