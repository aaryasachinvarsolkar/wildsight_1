# WildSight + Eco Ranger

This project has:

- Core WildSight backend in `backend/`
- Web frontend in `frontend/`
- Mobile Eco Ranger app in `eco-ranger-mobile/`

## Run The App (Windows)

Open 3 terminals from project root `D:\Github\wildsight_1`.

### 1) Start Backend (Terminal 1)

```powershell
Set-Location D:\Github\wildsight_1\backend
$env:GOOGLE_API_KEY="<your_api_key>"
D:\Github\wildsight_1\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Health check:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/v1/health
```

### 2) Start Web Dashboard (Terminal 2)

```powershell
Set-Location D:\Github\wildsight_1\frontend
npm.cmd install
npm.cmd run dev
```

Open:

- `http://localhost:5173`
- Eco Ranger dashboard: `http://localhost:5173/eco-ranger`

### 3) Start Mobile App (Terminal 3)

```powershell
Set-Location D:\Github\wildsight_1\eco-ranger-mobile
npm.cmd install
npm.cmd start
```

If testing on Android phone via USB:

```powershell
adb devices
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8081 tcp:8081
adb reverse --list
```

Open Expo Go on phone and load the shown `exp://...` URL.

## Quick Test Flow

1. On mobile, tap `Scan Species Image`.
2. Capture an image and allow location permission.
3. Verify result card appears on phone.
4. Check the same scan in web dashboard map and ranger profiles.

## Reset Eco Ranger Data (Optional)

This clears only Eco Ranger tables (`RangerScan`, `SpeciesLog`, `ValidationRecord`):

```powershell
Set-Location D:\Github\wildsight_1\backend
@'
from sqlmodel import Session, delete
from app.models.db import eco_ranger_engine, RangerScan, SpeciesLog, ValidationRecord

with Session(eco_ranger_engine) as session:
    session.exec(delete(ValidationRecord))
    session.exec(delete(SpeciesLog))
    session.exec(delete(RangerScan))
    session.commit()
print("Eco Ranger data cleared")
'@ | D:\Github\wildsight_1\.venv\Scripts\python.exe -
```

## Common Fixes

- If PowerShell blocks npm scripts, use `npm.cmd` instead of `npm`.
- If mobile says network failed, verify backend is running and run `adb reverse` commands again.
- If port 8000 or 5173 is busy, stop existing process and restart the service.


