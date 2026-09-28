# Privacy Policy for Vocab Hub

**Effective Date:** August 6, 2026  
**Last Updated:** August 6, 2026  
**Operating Entity:** Upquarx Technology Private Limited ("Upquarx", "We", "Us", or "Our")  
**Product / Platform:** Vocab Hub (developed in partnership with JobManch.ai)  

---

## 1. Introduction & Privacy Commitment
Vocab Hub is engineered with a **privacy-by-design** philosophy. We believe your personal learning data belongs strictly to you. 

This Privacy Policy explains our data practices and complies with applicable global data privacy regulations, including:
* **India Digital Personal Data Protection (DPDP) Act, 2023**
* **EU General Data Protection Regulation (GDPR)**
* **California Consumer Privacy Act (CCPA/CPRA)**
* **Information Technology Act, 2000 (India)**

Vocab Hub operates under the umbrella of **JobManch.ai** and **Upquarx Technology Private Limited**. This Policy inherits and incorporates the core data privacy commitments of:
* **JobManch.ai Privacy Policy:** [https://jobmanch.ai/privacy-policy/](https://jobmanch.ai/privacy-policy/)
* **Upquarx Technology Governance Standards:** [https://upquarx.com/#terms](https://upquarx.com/#terms)

---

## 2. Information We Collect (And What We Do NOT Collect)

### A. Data Stored Locally on Your Device (On-Device Data)
Vocab Hub is an **offline-first** mobile application. The following data is generated and stored locally in your device's sandbox storage via WatermelonDB/SQLite:
* **Personal Dictionary:** Words, definitions, pronunciations, synonyms, antonyms, example sentences, layman explanations, and word origins added by you.
* **Learning Progress:** Quiz scores, streak map history, streak freezes, repair challenges, and game milestones.
* **App Preferences:** Daily word goal, Travel Mode audio speed/pitch settings, theme choices (Light/Dark), and game sound toggles.

> **Zero Cloud Tracking:** We do NOT transmit, sync, backup, sell, or rent your local dictionary data or quiz scores to any external cloud servers.

### B. Third-Party API Auto-Fill Requests
When you use the "Auto-fill" button while adding a word, the Application sends a direct HTTP `GET` request to external dictionary endpoints (`api.dictionaryapi.dev`, `api.datamuse.com`, `en.wiktionary.org`). 
* Only the requested word string (e.g., `"Meticulous"`) is transmitted.
* No personal identifying information (PII), device UUIDs, or user profiles are attached to these dictionary lookup queries.

### C. Account Data (Optional)
Vocab Hub can be used in full without an account. If you choose to sign in:
* Authentication is handled by **Supabase**, our cloud authentication provider. You may sign in with an email address and password, a one-time code emailed to you, or a linked Google, GitHub, Microsoft/Azure, or Apple account.
* Supabase stores your email address, authentication identifier, and session token on its servers so that you can sign in again.
* Your personal dictionary, quiz scores, streak history, and preferences are **not** uploaded as part of signing in — they remain on your device.
* Signing out removes the session from your device.

### D. Email Notifications (Optional)
Settings lets you save a notification address and turn notifications on:
* That address is stored **locally on your device**. Saving it does not upload it.
* **This version of the Application sends no lifecycle email.** The delivery path exists but is dormant: were it enabled, messages would wait in a local outbox and be dispatched by a server-side **Supabase Edge Function** relaying over authenticated Hostinger SMTP (`smtp.hostinger.com`, SSL/port 465), with mail-server credentials held only on that server and never shipped inside the Application. This section will be updated before any such email is sent.
* We do not sell or share your email address with third-party data brokers or advertisers.

---

## 3. Compliance with Data Protection Acts

### A. Compliance with India DPDP Act, 2023
* **Data Minimization & Purpose Limitation:** We collect zero unnecessary personal data. Processing is strictly limited to rendering vocabulary features on your local device.
* **Right to Erasure:** You retain 100% control over your data. You can erase all personal vocabulary entries, streak history, and preferences instantly by deleting the app. To delete an account and its stored email address, contact the Privacy Desk listed in Section 7.
* **No Children's Data Processing:** Vocab Hub does not track or profile users under 18 years of age.

### B. Compliance with EU GDPR & CCPA
* **Right to Access & Portability:** You can export your entire personal dictionary at any time to standard CSV format via the Import/Export tool in Settings.
* **Right to Object / Opt-Out:** Since no tracking cookies, analytics SDKs, advertising IDs (IDFA/GAID), or telemetry suites are integrated into Vocab Hub, no opt-out is required—privacy is enforced by default.

---

## 4. Third-Party Links & Partner Attribution
Vocab Hub contains reference links to our partner platforms:
* `JobManch.ai` ([https://jobmanch.ai](https://jobmanch.ai))
* `Upquarx.com` ([https://upquarx.com](https://upquarx.com))

Tapping these links opens your device's native browser. Tapping external links subjects your browsing session to the respective privacy policies of those websites.

---

## 5. Security Measures
Local database records are protected by operating system device-level sandbox security (iOS App Sandbox and Android Internal Storage permissions). Account credentials and session tokens, where you have chosen to create an account, are held by Supabase and protected by that provider's infrastructure security; mail-server credentials are likewise held server-side and never ship inside the Application. Because your vocabulary collection, quiz scores, and streak history never leave your device, they cannot be exposed by a breach of any cloud service.

---

## 6. Updates to This Policy
We may update this Privacy Policy periodically to reflect app updates or regulatory changes. Any updates will be included in the Application's Settings section and documented in the `.md` files within the repository.

---

## 7. Privacy Contact & Grievance Officer
For questions, privacy inquiries, or exercising data rights under DPDP or GDPR:

* **Data Protection / Grievance Contact:** Privacy Desk, Upquarx Technology Private Limited
* **Email:** `contact.vocabhub@jobmanch.ai`
* **Corporate Address:** Upquarx Technology Private Limited, Mumbai, Maharashtra, India
* **Websites:** [https://jobmanch.ai/privacy-policy/](https://jobmanch.ai/privacy-policy/) | [https://upquarx.com](https://upquarx.com)