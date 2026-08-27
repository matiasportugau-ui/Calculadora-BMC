# Improvements (backlog)

Do not implement from `/voice-xia` unless the user picks one. Prefer closing [implementation-plan.md](implementation-plan.md) A–D first.

- Unify Hands-free and Realtime onto the same `messages` append path (phase A).
- Enable `session.resumption` on Grok reconnect; cap vs 120 min session.
- xAI Collections / `file_search` for catalog + lessons (optional vs `VITE_FEATURE_BRAIN` GCS).
- HITL: turn on `VITE_FEATURE_BRAIN` in Doppler backend when lessons should enter voice.
- VAD duplicate user transcripts.
- wolfboard `rowNum` vs Admin `adminRow`.
- ASR glossary beyond keyterms (planilla/parrilla/sonrilla already in instructions).
- Rotate Sheets SA key if JSON ever leaked to the model (`googleSheetsAuth` redacts; rotation is HITL).
- If history is long, seed a summary item instead of every turn (token economy).
- Voice picker Ara/Eve/Leo (SDD grok-voice-agent P2); pack already uses `eve`.
- Binary WS audio (handoff 2026-08-11 residual).
