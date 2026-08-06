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
* **Learning Progress:** Quiz scores, streak map history, streak freezes, repair challenges, game milestones, and XP levels.
* **App Preferences:** Daily word goal, Travel Mode audio speed/pitch settings, theme choices (Light/Dark), and game sound toggles.

> **Zero Cloud Tracking:** We do NOT transmit, sync, backup, sell, or rent your local dictionary data or quiz scores to any external cloud servers.

### B. Third-Party API Auto-Fill Requests
When you use the "Auto-fill" button while adding a word, the Application sends a direct HTTP `GET` request to external dictionary endpoints (`api.dictionaryapi.dev`, `api.datamuse.com`, `en.wiktionary.org`). 
* Only the requested word string (e.g., `"Meticulous"`) is transmitted.
* No personal identifying information (PII), device UUIDs, or user profiles are attached to these dictionary lookup queries.

### C. Outbound Email Communications (Optional)
If you opt-in to configure email notifications in Settings:
* Your email address is stored locally on your device.
* Transactional lifecycle emails (Welcome, Milestone celebrations, Streak alerts) are dispatched securely via authenticated Hostinger SMTP (`smtp.hostinger.com` over SSL/Port 465) directly to your configured address.
* We do not sell or share your email address with third-party data brokers or advertisers.

---

## 3. Compliance with Data Protection Acts

### A. Compliance with India DPDP Act, 2023
* **Data Minimization & Purpose Limitation:** We collect zero unnecessary personal data. Processing is strictly limited to rendering vocabulary features on your local device.
* **Right to Erasure:** You retain 100% control over your data. You can erase all personal vocabulary entries, streak history, and preferences instantly by deleting the app or tapping "Clear Local Storage" under Settings.
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
Local database records are protected by operating system device-level sandbox security (iOS App Sandbox and Android Internal Storage permissions). Because no user data resides on external cloud servers, cloud data breaches are inherently impossible.

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