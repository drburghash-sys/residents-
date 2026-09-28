Unified General Surgery Pathway + Resident Distribution — V1

PURPOSE
This repository now contains one simplified single-user workflow that replaces the separate Surgical Pathway / coordinator-readiness / resident case tracker workflow.

CURRENT DATA
- 24 active cases were seeded from the readiness report supplied on 2026-09-28.
- Their readiness counts match that report:
  DSU: 4 ready, 2 waiting for signature, 0 not ready.
  Elective: 5 ready, 4 waiting for signature, 9 not ready.
- Historical cases from the supplied Surgical Pathway APK backup are retained as archived seed records.
- On first launch, the app also attempts to migrate the resident roster and matching case ownership from the previous resident tracker localStorage on the same GitHub Pages origin.

ONE PATIENT RECORD
Each patient record contains:
- Patient name and MRN
- DSU or Elective pathway
- Diagnosis and procedure
- Preparation checklist: CXR, Blood, Virology, Consultations, Anesthesia, ECG, Documents/signature
- Resident ownership
- Operation outcome and history

READINESS
- Ready: no required item remains incomplete.
- Waiting for signature: the only missing item is documents/signature.
- Not ready: at least one other required item remains incomplete.

RESIDENT RULES
- One case has one resident owner only.
- Cases already owned are never taken away during redistribution.
- Resident reply is entered manually by the consultant: complete all, partial completion, or failed preparation.
- Failed preparation converts the case to Consultant Only. It is not reassigned to another resident and gives no compensation.
- Completed operation normally releases the case and, when enabled, immediately assigns the resident one unassigned replacement case.
- If the resident prepared the case but misses the operation because of on-call, post-call, clinic, official duty, or official leave, the resident receives +1 compensation case in addition to the normal replacement logic.
- Compensation cases are assigned before ordinary fair balancing.
- Ordinary distribution then raises residents with lower current case loads. A remainder that cannot be assigned as a complete fairness layer stays unassigned for consultant decision.

WHATSAPP
Residents do not use the app.
The Reports screen creates ONE group message containing:
- Resident case-count summary
- Ready count
- Operations count
- Compensation balance
- Every resident and all of that resident's current cases with MRN, diagnosis, operation and current missing requirements
- Unassigned and Consultant Only counts
The consultant shares this one message to the residents' WhatsApp group and enters their replies manually into the app.

REPORTS
- Group distribution message
- Readiness report in the previous DSU/Elective coordinator-report style
- Activity history

STORAGE
- Single-device localStorage workflow; no Firebase is required because residents do not use the app.
- JSON backup/restore is available in Settings.
- Previous resident-app data is not deleted.

BACKUP BRANCHES
- backup-v5-before-case-ownership
- backup-before-unified-surgery-20260928
