# Workout Tracker v3 (Hybrid + Summary)

## New in v3
- Luke structure: 1 sprint+upper accessory day, 1 cardio+shoulders day, 2 upper days, 1 legs day (editable in data.json)
- Cardio logging (run, incline walk, bike, row, sprints, etc.) with MET override
- Weekly Summary tab:
  - Cardio calories (MET-based)
  - Lift calories estimate (sets × kcal-per-set)
  - Sets logged per muscle group

## Local dev
```bash
python3 -m http.server 8080
```
Open http://localhost:8080

## Deploy
Upload files to repo root and enable GitHub Pages.
