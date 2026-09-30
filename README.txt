General Surgery OR Days + Patient Pool — V2

CORE WORKFLOW
- Sunday = DSU OR day.
- Thursday = Elective OR day.
- Standard OR days are generated per selected month.
- One OR day may belong to one resident or be shared by multiple residents.
- The number of cases per OR day is not fixed.
- Additional OR days can be created at any date when the OR department releases extra capacity.
- Additional-day announcement text can be shared to the residents group; assignment is then entered manually.
- There is no automatic fairness/compensation algorithm. The consultant manually balances extra or missing OR days.

PATIENT POOL
- Active non-emergency cases live in Patient Pool until linked to a specific OR day.
- A case is not permanently owned by a resident.
- When linked to an OR day, each case may have one Prepared By resident and a role: Main or Reserve.
- A Reserve case can be switched to Main immediately if an extra OR place becomes available.
- Readiness remains driven by CXR, Blood, Virology, Consultations, Anesthesia, ECG and Documents/signature.

OPERATIONS
- A case enters the monthly report only after "Operation Done" is confirmed.
- Prepared By and Operated By are stored separately.
- Closing an OR day returns every unoperated case to Patient Pool while preserving its preparation status.
- Emergency cases never enter OR-day assignment or resident distribution. They are recorded directly after the operation.

RESIDENTS
- Residents choose whole OR days after the monthly on-call rota is released.
- Shared OR days are supported.
- Monthly resident statistics show solo OR days, shared OR days, cases prepared and operations performed.
- Resident deletion preserves historical completed-day/operation records.

MESSAGES
- Monthly OR-day schedule can be shared to the single residents WhatsApp group.
- Each OR day can generate one group message with residents, cases, Prepared By, Main/Reserve status and missing preparation items.
- Additional-day request message is available.

MIGRATION / BACKUP
- New storage key: surgery_or_days_v2.
- On first launch, the app automatically migrates local unified_surgery_residents_v1 data when present.
- Active V1 cases become Patient Pool cases and retain their preparation data.
- Previous resident ownership is retained only as legacy reference.
- Completed operations, points, OR hours and recovered historical monthly statistics are preserved.
- Restore supports both SURGERY_OR_DAYS_V2 and UNIFIED_SURGERY_RESIDENTS_V1 JSON backups.
- V2 backup contains cases, residents, OR days, event history, monthly historical recovery data and settings.

BACKUP BRANCH
backup-before-or-day-system-20260930
