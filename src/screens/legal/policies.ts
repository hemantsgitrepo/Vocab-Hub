// Shipped copy of the legal documents rendered by LegalViewerScreen.
//
// These mirror `docs/legal/TERMS_OF_SERVICE.md` and
// `docs/legal/PRIVACY_POLICY.md`, which stay in the repository because the
// Privacy Policy itself promises updates are "documented in the `.md` files
// within the repository". Metro cannot bundle `.md` as source, so the text is
// embedded here — edit BOTH when the legal text changes.

export type PolicyId = 'terms' | 'privacy';

export interface PolicyDoc {
  id: PolicyId;
  /** Short label for the segmented toggle. */
  tab: string;
  title: string;
  subtitle: string;
  markdown: string;
}

export const EFFECTIVE_DATE = 'August 6, 2026';

export const TERMS_OF_SERVICE: PolicyDoc = {
  id: 'terms',
  tab: 'Terms',
  title: 'Terms of Service',
  subtitle: 'Usage terms & governance backed by JobManch.ai & Upquarx',
  markdown: `# Terms of Service for Vocab Hub

**Effective Date:** August 6, 2026  
**Last Updated:** August 6, 2026  
**Operating Entity:** Upquarx Technology Private Limited ("Upquarx", "Company", "We", "Us", or "Our")  
**Product / Platform:** Vocab Hub (developed in partnership with JobManch.ai)  

---

## 1. Acceptance of Terms & Governance Inheritance
By downloading, installing, accessing, or using the **Vocab Hub** mobile application ("Application"), you ("User", "You") agree to be bound by these Terms of Service ("Terms"). 

**Vocab Hub** is an offline-first mobile application developed by the **JobManch.ai** team and powered by **Upquarx Technology Private Limited** (\`Upquarx.com\`). These Terms explicitly incorporate and extend the operational governance, general disclaimers, and legal frameworks established under:
* **JobManch.ai Terms of Service:** [https://jobmanch.ai/terms/](https://jobmanch.ai/terms/)
* **Upquarx Technology Governance Policy:** [https://upquarx.com/#terms](https://upquarx.com/#terms)

If you do not agree with all provisions of these Terms or the incorporated policies of JobManch.ai and Upquarx, do not install or use the Application.

---

## 2. Description of Service
Vocab Hub provides users with an offline-first personal vocabulary builder, text-to-speech commute audio playback ("Travel Mode"), spaced repetition quizzes, and gamified word challenges. 

- **Offline-First Storage:** All personal vocabulary entries, quiz scores, game progress, and application preferences are stored locally on your device via an embedded database (WatermelonDB/SQLite).
- **No Cloud Account:** Vocab Hub operates without requiring account registration, cloud syncing, or server-side user profiles.
- **Third-Party API Integration:** The Application uses \`api.dictionaryapi.dev\` (Free Dictionary API), \`api.datamuse.com\`, and Wiktionary API solely to auto-populate dictionary entries (pronunciations, definitions, synonyms, and origins) upon explicit user request.

---

## 3. License Grant & Intellectual Property
Subject to your compliance with these Terms, Upquarx grants you a limited, non-exclusive, non-transferable, revocable license to download and use Vocab Hub for personal, non-commercial educational purposes.

All intellectual property rights in Vocab Hub—including source code, UI/UX designs, graphic assets, trade names, "Vocab Hub", "JobManch.ai", and "Upquarx" logos—are owned exclusively by Upquarx Technology Private Limited and its software partners. You shall not reverse engineer, decompile, modify, distribute, or create derivative works based on the Application.

---

## 4. User Conduct & Acceptable Use
You agree to use Vocab Hub strictly for lawful educational purposes. You agree not to:
* Use the Application in any manner that violates local, national, or international laws.
* Attempt to bypass, compromise, or alter device-level database encryption or local data structures.
* Misuse automated APIs or script bulk requests through the Application.

---

## 5. Disclaimer of Warranties
Vocab Hub is provided on an **"AS IS"** and **"AS AVAILABLE"** basis without warranties of any kind, express or implied. 

Upquarx and JobManch.ai do not guarantee that:
1. Dictionary auto-fill definitions derived from open third-party APIs (\`api.dictionaryapi.dev\`, Wiktionary) are completely accurate, error-free, or current.
2. The Application will run uninterrupted or error-free on all mobile devices or operating systems.
3. The educational content guarantees specific scores or outcomes in third-party competitive examinations (e.g., GRE, CAT, GMAT, UPSC).

---

## 6. Limitation of Liability
To the maximum extent permitted by applicable law (including Indian law under the Information Technology Act, 2000 and DPDP Act, 2023), Upquarx Technology Private Limited, JobManch.ai, their directors, officers, employees, and affiliates shall not be liable for any indirect, incidental, consequential, special, or punitive damages—including data loss, device corruption, or study disruption—arising out of your use or inability to use the Application.

In no event shall Upquarx's total cumulative liability exceed the amount paid by you for the Application (if any) or INR ₹100, whichever is less.

---

## 7. Governing Law & Dispute Resolution
These Terms shall be governed by and construed in accordance with the laws of **India**, without regard to conflict of law principles. Any legal suit, action, or proceeding arising out of or related to these Terms or Vocab Hub shall be instituted exclusively in the courts located in **Mumbai, Maharashtra, India**.

---

## 8. Contact Information
For questions regarding these Terms of Service or corporate governance:
* **Operating Entity:** Upquarx Technology Private Limited
* **Team:** JobManch.ai Development Team
* **Email:** \`contact.vocabhub@jobmanch.ai\`
* **Websites:** [https://jobmanch.ai](https://jobmanch.ai) | [https://upquarx.com](https://upquarx.com)`,
};

export const PRIVACY_POLICY: PolicyDoc = {
  id: 'privacy',
  tab: 'Privacy',
  title: 'Privacy Policy',
  subtitle: 'DPDP & GDPR compliant • 100% On-Device Privacy',
  markdown: `# Privacy Policy for Vocab Hub

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
When you use the "Auto-fill" button while adding a word, the Application sends a direct HTTP \`GET\` request to external dictionary endpoints (\`api.dictionaryapi.dev\`, \`api.datamuse.com\`, \`en.wiktionary.org\`). 
* Only the requested word string (e.g., \`"Meticulous"\`) is transmitted.
* No personal identifying information (PII), device UUIDs, or user profiles are attached to these dictionary lookup queries.

### C. Outbound Email Communications (Optional)
If you opt-in to configure email notifications in Settings:
* Your email address is stored locally on your device.
* Transactional lifecycle emails (Welcome, Milestone celebrations, Streak alerts) are dispatched securely via authenticated Hostinger SMTP (\`smtp.hostinger.com\` over SSL/Port 465) directly to your configured address.
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
* \`JobManch.ai\` ([https://jobmanch.ai](https://jobmanch.ai))
* \`Upquarx.com\` ([https://upquarx.com](https://upquarx.com))

Tapping these links opens your device's native browser. Tapping external links subjects your browsing session to the respective privacy policies of those websites.

---

## 5. Security Measures
Local database records are protected by operating system device-level sandbox security (iOS App Sandbox and Android Internal Storage permissions). Because no user data resides on external cloud servers, cloud data breaches are inherently impossible.

---

## 6. Updates to This Policy
We may update this Privacy Policy periodically to reflect app updates or regulatory changes. Any updates will be included in the Application's Settings section and documented in the \`.md\` files within the repository.

---

## 7. Privacy Contact & Grievance Officer
For questions, privacy inquiries, or exercising data rights under DPDP or GDPR:

* **Data Protection / Grievance Contact:** Privacy Desk, Upquarx Technology Private Limited
* **Email:** \`contact.vocabhub@jobmanch.ai\`
* **Corporate Address:** Upquarx Technology Private Limited, Mumbai, Maharashtra, India
* **Websites:** [https://jobmanch.ai/privacy-policy/](https://jobmanch.ai/privacy-policy/) | [https://upquarx.com](https://upquarx.com)`,
};

export const POLICIES: PolicyDoc[] = [TERMS_OF_SERVICE, PRIVACY_POLICY];
