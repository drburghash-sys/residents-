General Surgery Resident Case Ownership — V1

CURRENT WORKFLOW
- A surgical case has exactly ONE resident owner.
- New cases can be added manually or imported from a coordination PDF/text.
- Distribution only touches UNASSIGNED cases. It never takes an active case away from its current resident.
- The algorithm first raises residents with lower active loads until loads become equal.
- Once all active resident loads are equal, a full equal layer is assigned only when there are enough cases for EVERY active resident.
- Any remainder stays UNASSIGNED as "consultant decision surplus" for manual assignment.
- Resident order can be changed; it is used as the stable tie-break order.

CASE LIFECYCLE
1) UNASSIGNED
2) ASSIGNED / under preparation
3) READY — preparation complete and the case remains fixed to that resident
4) DONE — operation completed by that resident
If the resident fails to prepare/keep the case, it becomes CONSULTANT ONLY and is never reassigned to another resident.

REPLACEMENT
- Optional automatic replacement is enabled by default.
- After a resident completes the operation, the first currently unassigned case can be assigned to the same resident as a replacement.
- Failed cases do NOT automatically generate a replacement; they are handled at the next fair distribution.

PDF IMPORT
- PDF text is read locally in the browser using PDF.js.
- The import screen always requires review before cases are committed.
- If PDF text order is poor, paste the coordination-program text into the same importer and re-parse.
- No PDF is uploaded by this static GitHub Pages app.

STORAGE
- Data is stored in localStorage on the device.
- Backup exports a JSON snapshot.
- The previous V5 localStorage data is not deleted. On first launch of this version, residents and old cases are migrated into the new data model.

BACKUP OF PREVIOUS VERSION
- Git branch: backup-v5-before-case-ownership

MULTI-DEVICE NOTE
- This build is an administrator/device-local workflow.
- Direct resident updates from separate phones require a shared backend such as Firebase; localStorage alone cannot synchronize multiple devices safely.
