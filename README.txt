Resident Case Tracker V4 PWA

DEPLOYMENT
1. Create a GitHub repository, for example: resident-case-tracker
2. Upload all files in this ZIP to the repository root:
   index.html
   manifest.webmanifest
   sw.js
   icon-192.png
   icon-512.png
3. Enable GitHub Pages for the main branch / root.
4. Open the GitHub Pages URL in Chrome on Android.
5. Use "Add to Home screen" / "Install app".
6. After installation, Resident Case Tracker should appear as a share target for text shared from supported Android apps such as WhatsApp.

IMPORTANT
- Share-target reception requires the app to be hosted over HTTPS and installed as a PWA.
- Opening index.html directly from Downloads will NOT register it as a WhatsApp share target.
- Incoming messages are processed automatically when they contain CASE_ID and RESIDENT_NAME.
- Post-op message example:
  POST_OP=YES
  CASE_ID=GS-260921-1234
  OPERATED_BY=Dr Ahmed

FOLLOW-UP CREDIT RULES IMPLEMENTED
- Every pending requirement newly changed to DONE by a resident = +1 current balance.
- Re-sending an already DONE item gives no extra credit.
- Adding a new requirement gives no credit until it is actually completed.
- Operation recorded after surgery = -1 from the operating resident.
- If a Missed Priority Resident was recorded before surgery, successful post-op processing gives that resident +1 compensation.
- "This Week" is calculated automatically from Monday and does not need a manual reset.
- Current Balance does not reset automatically.

PRIVACY
The app stores data locally in the browser/PWA storage on your device. Use Backup regularly.


V5 UPDATE
- WhatsApp follow-up messages contain CURRENT PENDING REQUIREMENTS ONLY.
- Completed requirements disappear from the next shared message.
- The first valid resident message that changes an item from PENDING to DONE receives +1 credit.
- Later duplicate DONE reports for the same item receive 0 credit.
- After processing a resident update, the app offers Share Updated Pending List.
