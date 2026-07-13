# CapitalFusionIQ
## Product Requirements Document

**Status:** WIP
**Product:** CapitalFusionIQ — AI-assisted Capital Readiness & Capital Matching Engine for SMBs

---

## 1. Problem Definition

### What problem is this solving?

Small and medium-sized businesses (SMBs) face significant challenges in getting adequate financing from Banks, SMB lenders and Family Offices. Key pain points include:

- **Limited financial understanding:** SMB owners and managers often struggle to interpret their current potential, credit worthiness and how best to position themselves. This knowledge gap can lead to misunderstandings or missed opportunities.
- **Manual review is slow and error-prone:** Reviewing financial data and pulling together key metrics is time-consuming and expensive. Human reviewers can miss details or make mistakes due to fatigue. Financial consulting firms often charge $100–200/hr, yet even careful analysts might overlook details — a study found an AI was 10% more accurate at spotting risks and positioning SMBs for financing.
- **Difficulty in risk assessment and compliance:** Identifying risky clauses or ensuring regulatory compliance (e.g. privacy laws, industry regulations) is hard without specialized industry/legal knowledge and benchmarking against similar companies in the same sector.

### Who are you solving this problem for?

**Primary users:** Financial Consulting firms which work with SMBs, Financial departments in SMBs, and financial departments in Banks and Secondary lenders across various industries.

**Industries:** Financial consulting firms, consultants, banks, lenders, finance departments of SMBs.

**User roles:** Business owners, CEOs, CFOs, financial consultants, financial consulting firm heads who frequently review and pitch SMBs for financing.

CapitalFusionIQ can serve as a first-pass review tool to flag issues, provide a credit worthiness check and a ballpark financing range before involving expensive consulting help.

### Why is this problem worth solving?

- **Lack of potential for growth:** SMBs struggle after a certain threshold to get legitimate financing — causing them to slow down, get stuck in firefighting mode, and lose the opportunity to build something big.
- **Efficiency and accuracy gains with AI:** AI-driven financial analysis can cut review times by over 60%. Faster reviews mean SMBs execute deals sooner.
- **Gap in current solutions:** Typical financial management software stores financial data but lacks intelligent insight. There's a market gap for a tool that understands credit worthiness, potential for financing, and provides guidance tailored to resource-strapped SMBs.

### How will you know that the problem is solved?

- **Reduced review time:** At least 60% reduction in SMB financials review time for financial analysts (8–12 hours → under 1 hour)
- **Improved accuracy:** >90% accuracy in extracting key trends and financial data; catch most risk factors (liabilities, debt, profit and sales trends)
- **High user adoption and satisfaction:** Active SMB accounts, retention over several financial review cycles, high NPS

---

## 2. Market Analysis

**Market Size:** Global SMB lending market ~$5.5T (2024); fintech lending sub-segment at $504B (2025)

**Growth Rate:** SMB lending CAGR 13% (2024–2032); AI-in-finance CAGR ~30% (2024–2030); AI credit scoring CAGR 25.9% (2024–2031)

**Key Drivers:**
- 70% surge in SMB fintech lending adoption (17% → 29% of applicants, 2020–2025)
- AI-driven underwriting cutting loan decision times from 49 days to near-instant
- 76% of small businesses now turning to non-bank lenders; 74% choose fintech over traditional banks
- Revenue-based financing grew 70.9% YoY, reaching $5.78B (projected $41.8B by 2028)
- SBA guaranteed $45B across 84,000+ loans in FY2025, up 15% over FY2024

**Gaps & Opportunities:**

The entire competitive field is lender-centric: Taktile, Ocrolus, and Biz2X all sell to banks and fintechs to make their underwriting faster. Nav and Lendio serve SMBs but as lead-gen/matching engines — not as intelligent financial advocates. No incumbent offers:
- AI-driven financial package assembly from the SMB's POV
- Sector-specific benchmarking against similar companies seeking financing
- Family office and alternative capital access combined with readiness coaching
- Compliance and risk clause review built for the borrower (not the lender)

**This is CapitalFusion's open lane and clear defensible MOAT.**

**Differentiation from generic AI tools:** This solution is specifically trained on SMB data and benchmarked against industry standards. It involves mapping against a checklist of documents, reading structured and unstructured data, and normalizing this data for that SMB as a first step — not solvable with a generic AI agent.

---

## 3. Solution Definition

CapitalFusion is an AI-assisted Capital Readiness & Capital Matching engine for SMBs. The solution produces a repeatable AI-driven advisory which ingests SMB financials, diagnoses capital readiness, identifies risks, estimates debt/equity capacity, recommends optimal financing structures, and maps to likely funding counterparties.

### User Flows

#### Financial Ingestion Agent

1. **Upload & Ingestion:** User logs in and uploads financial information (Excel, QuickBooks, PDFs, bank statements, aging reports, forecasts). Supports PDFs, DOC/DOCX, scanned images via OCR.
2. **AI Analysis Pipeline:** Uploaded information is processed automatically, checked against a standard set of required documents for completeness. OCR extracts text from scanned documents. System extracts key financial information (P&L, cash flow, balance sheet). Flags missing data and surfaces the missing data list to the user.
3. **Insights & Results Presentation:**
   - Plain-language summary of financial data provided
   - Normalized financial statements (cleansed balance sheet, P&L, cash flow)
   - Historical trend tables
   - Risk flags / warnings for missing or inconsistent data
   - Compliance checks (if applicable)
4. **User Actions:**
   - **Chat/Q&A:** Ask questions like "What are my main debt classifications?"
   - **Drill-down:** Click on a risk flag to see details & suggestions
   - **Export:** Download insights as PDF or Word document
   - **Approve & Integrate:** Proceed to Credit and Capital Readiness step

#### Credit & Capital Readiness Agent

- Ingests output from Financial Ingestion Agent + manually uploaded projections
- Checks for completeness; flags missing information with a call to action
- Analyzes: Leverage Ratios, DSCR, FCCR, working capital efficiency, liquidity profile, borrowing base indicators, covenant stress flags, cash conversion cycles
- Presents: Capital Readiness Score, Bankability Score, Institutional Equity Readiness Score, estimated capital that can be secured
- Drill-down explanations for each score
- Risk flags and compliance checks

#### Capital Structure Recommendation Agent

- Uses readiness scores to recommend the ideal type of funding:
  - Stable Cash Flow + Assets → Senior Debt/ABL
  - Fast growth + weak collateral → Venture Debt/Preferred Equity
  - EBITDA positive but overleveraged → Subordinate Debt/Structured Equity
  - Heavy Capex expansion → Equipment Finance + Term Debt + Working Capital Line
- Provides: plain-language summary, target raise amount, estimated pricing range, dilution implications, covenant considerations

---

## 4. Functional Requirements — Prototype

- **Document Ingestion & OCR:** PDF (text + scanned), Microsoft Word, image files; OCR for scanned documents; handle complex layouts (multi-column, embedded tables)
- **Key Financial Data Extraction:** Extract and normalize P&L, cash flow, balance sheet, classified chart of accounts
- **Readiness Scoring & Capital Structure Recommendations:** Readiness scores with detailed explanations and appropriate capital structure recommendations
- **Risk Assessment & Alerts:** AI-driven risk analysis module; human review required before sharing with customer
- **Compliance Checks:** Industry/law-specific compliance using RAG against a knowledge base of regulations
- **Summarization:** Natural language summary of financial information; no hallucinations; grounded strictly in provided data
- **User Interface & Visualization:** Interactive dashboard, drill-down to source data, filtering and searching, toggle between financial summary and AI insights
- **Integrations:** CRM (Salesforce, HubSpot), Document Management (Dropbox, Google Drive, OneDrive), Email/Slack notifications, completeness checklists
- **Secure Cloud Storage:** AES-256 encryption at rest, TLS in transit, per-user isolation, GDPR compliance, region-specific storage, versioning
- **User Management & Permissions:** Multi-user roles (owner, manager, external analyst); view vs. upload permissions
- **Feedback Loop:** User corrections to AI output; feeds model improvement pipeline
- **Human Review Gate:** All recommendations must be reviewed and approved by a human before sharing with end user

---

## 5. Prioritization

Building components in this order (each builds on the previous):

| Priority | Component | Rationale |
|---|---|---|
| 1 | Financial Ingestion Agent | Entry point; OCR + normalization; low risk, known techniques |
| 2 | Credit & Capital Readiness Agent | Requires normalized output from Agent 1 |
| 3 | Capital Structure Recommendation Agent | Requires readiness scores from Agent 2 |

### Risk Assessment by Component

| Component | Risk Level | Key Mitigation |
|---|---|---|
| Document Ingestion & OCR | Medium | Robust OCR engine; fallback checks; manual review flag for low-confidence |
| Risk Analysis & Compliance | High | Knowledge base of risk patterns; ML + rule checks in tandem; regular updates |
| Financial Data Summarization & Q&A | Medium | Strict prompt engineering; RAG with source text; hallucination check in eval harness |
| Integrations | Medium | Secure APIs (OAuth2); encrypt at rest and in transit; least-privilege access |
| Data Privacy & Security | High | AES-256; TLS; role-based access; data residency controls; SOC 2 practices |
| Performance & Scalability | Medium | Efficient inference pipeline; caching; hybrid model approaches; autoscaling |
| Legal Disclaimers & Liability | Medium | Prominent disclaimers; human review gate; clear logs of AI outputs |
| Model Bias & Domain Coverage | Medium | Diverse training corpus; user feedback; bias monitoring by sub-segment |

---

## 6. Roadmap

| Release | Features | Duration |
|---|---|---|
| **MVP** | Financial Ingestion Agent: outputs Balance Sheet, P&L, Cash Flow Statement & EBITDA. Flags missing data. Download completed financial package. If no data: use industry comparables via TAM/SAM/SOM. Optional: 5-year Long Range Plan starting point. | 6 weeks |
| **MVP 1** | All MVP features + enhanced Financial Ingestion Agent with sophisticated metrics. Based on EBITDA, enable manual projection upload. Combine financial info + projections to generate readiness score benchmarked against industry. Basic next-step recommendations. | 6 weeks |
| **Iteration** | Refine agents above. Add Capital Structure Advisory Agent. Targeted recommendations, potential lenders and lender categories. | TBD |

---

## 7. Evaluation Strategy

### What the Agents Are Being Evaluated On

| # | Output | What "correct" means |
|---|---|---|
| 1 | Financial metric extraction | Numbers match source document within tolerance |
| 2 | Capital readiness score | Within ±8 points of expert-assigned score; correct band |
| 3 | Capital structure recommendation | Instrument type matches or is one step adjacent on the capital stack |
| 4 | Risk flag identification | Catches ≥75% of expert-flagged risks; false positive rate <30% |
| 5 | Explanation quality / no hallucination | No facts asserted that aren't in the input document |

### Evaluation Phases

| Phase | Dataset | Size | Purpose | Gate |
|---|---|---|---|---|
| Phase 1 — Pre-Launch | Synthetic SMB profiles | 80–100 profiles | Catch gross failures before real data | Must pass before beta access |
| Phase 2 — Beta | Anonymized real cases from consulting firm | 20–30 cases | Validate scores against real lender outcomes | Score-to-outcome correlation before commercial launch |
| Phase 3 — Production | Flagged live cases + synthetic additions | Ongoing | Detect model drift and regression | Triggers model refresh when metrics degrade |

**Current state:** 12 synthetic test cases exist in `data/eval_test_cases.json` covering Canadian Food & Beverage sector.

### Accuracy Targets

- Risk flag detection: >85% precision and >85% recall (MVP target on synthetic test set)
- Capital readiness score deviation: ±8 points of expert-assigned score
- Expert review: >90% of agent recommendations rated "appropriate with no critical instrument errors"
- Beta user satisfaction: 80% agree risk flags were relevant and capital structure was appropriate

### Launch Criteria

| Stage | Helpful | Honest | Harmless |
|---|---|---|---|
| Launch (1–2%) | 60% | 75% | <5% |
| Beta (2–10%) | 70% | 85% | <3% |
| Launch | 80% | 90% | <2% |

---

## 8. Data Requirements

### Input Data (User-Supplied)

| Input Type | Examples | Processing Required |
|---|---|---|
| Text-based PDF | Accountant-prepared P&L | Direct text extraction |
| Scanned PDF / Image | Paper statements, photos | OCR → text extraction |

**Three canonical artifacts** the Ingestion Agent must always produce: normalized Profit & Loss statement, Balance Sheet, and Cash Flow Statement (derived from P&L + Balance Sheet if missing). Plus: Vertical analysis, Horizontal analysis, and additional metrics (CCC, DSO, DIO, DPO).

### Reference / Benchmark Data

Current benchmark layer covers Canadian Food & Beverage (15 public companies in `data/canada_food_beverage_financials.json`).

**Benchmark expansion plan:**
- Phase 1 (Pre-launch): Canada F&B only
- Phase 2 (Beta): Add Canadian Manufacturing, Retail, Services
- Phase 3 (Production): US comparable datasets for cross-border financing

**Key benchmarked metrics per sector:** EBITDA margin, gross margin, debt-to-equity, ROE, DSCR thresholds

### Synthetic Dataset Stratification

| Sub-segment | Target Profiles | Scenario Split |
|---|---|---|
| Food Retail / Grocery | 12–15 | 40% borderline (score 45–60) |
| QSR / Franchise | 10–12 | 15% clearly fundable |
| Food Manufacturer / CPG | 15–18 | 20% high-risk / distressed |
| Beverage Producer | 10–12 | 10% declined |
| Distributor / Wholesaler | 10–12 | 15% low-moderate risk |
| Specialty / Artisan | 8–10 | — |
| Food Tech / Delivery | 6–8 | — |

Input quality varied: 40% clean PDF, 20% Excel, 20% good-quality scan, 10% poor-quality/partial OCR, 10% missing one financial statement.

### Data Security & Compliance

- All uploaded documents encrypted at rest (AES-256) and in transit (TLS/SSL)
- Per-user data isolation with role-based access controls
- Support for data residency requirements (Canadian-hosted storage for Canadian SMBs)
- GDPR-compliant handling for any EU-linked personal data
- SOC 2 practices for the SaaS platform layer
- Document versioning retained for audit

---

## 9. Prompt Strategy

### Agent 1: Financial Ingestion Agent
**Primary technique: Structured Output + Grounding**
- System prompt defines exact output schema (Excel/CSV/JSON with P&L, Balance Sheet, Cash Flow fields)
- Strict grounding: extract only values present in the uploaded document; if a field is not found, output null with a `missing_reason` flag
- Missing document detection: checklist of required documents; agent flags gaps before proceeding

### Agent 2: Credit & Capital Readiness Agent
**Primary techniques: Chain-of-Thought (CoT) + RAG + Few-Shot**
- CoT: reason step-by-step through each sub-score (Profitability, Liquidity, Leverage, Growth Trajectory, Business Quality) before producing composite readiness score
- RAG: retrieves sector benchmark percentiles from Canada F&B benchmark database at runtime
- Few-shot: 12 existing eval test cases serve as scored anchor examples

### Agent 3: Capital Structure Recommendation Agent _(not in initial scope)_
**Primary techniques: Decision-Tree Prompting + Constraint-Based Generation**
- Explicit decision framework mapping readiness profiles to instrument types
- Output constrained to defined instrument taxonomy

### Cross-Agent Anti-Hallucination Controls
- Explicit instruction: "Do not generate, estimate, or hallucinate financial figures not present in the provided document"
- Output validation layer: post-generation check comparing all numbers cited in narrative against extracted metrics JSON
- Confidence thresholds: low-confidence extractions flagged to user rather than silently passed downstream

---

## 10. Model Requirements

| Criteria | Requirement | Rationale |
|---|---|---|
| Open vs. Closed Source | Closed Source (MVP); open-source long-term | Faster time-to-market; GPT-4 class quality out of the box |
| Context Window | 128K+ | Long SMB financial documents (50+ pages) |
| Modalities | Text, Vision | Support PDFs, Excel, images; OCR pre-processing for scanned docs |
| Fine-Tuning | Not in Phase 1; SFT in Phase 2+ | Phase 1 uses prompt engineering + RAG; fine-tune when 200+ labeled cases available |
| Latency | High priority | Real-time Q&A; target <10s for summary |
| Accuracy | High priority | Financial domain; hallucinations are critical failures |
| Context | Large (≥32K tokens) | Full financial document in one pass |
| Integration | API accessible | Reliable uptime; secure; scalable |

### Model Trade-offs

| Option | Pros | Cons | Cost |
|---|---|---|---|
| GPT-4 via API | State-of-the-art; large context; no infra overhead | Higher per-token cost; data leaves environment | High variable |
| Fine-tuned Open-Source LLM | Full data control; lower incremental cost at scale | GPU infra needed; lower out-of-box quality; smaller context | High fixed, low variable |
| Hybrid (GPT-3.5 + GPT-4) | Cost-optimized; simpler tasks on cheaper model | Two-model complexity; context limits on GPT-3.5 | Medium |

**Initial approach:** GPT-4 API for quality; re-evaluate to fine-tuned open model as labeled dataset grows.

---

## 11. Responsible AI

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Hallucination / Fabricated Financial Data | High | Critical | Grounding prompts + post-generation validation; hallucination check in eval harness; human review required before sharing with lenders |
| 2 | Biased Credit Scoring | Medium | High | Synthetic dataset stratified across sub-segments; bias audits on readiness scores; explainable sub-scores |
| 3 | SMB Data Privacy Breach | Low | Critical | AES-256 at rest; TLS in transit; per-user isolation; GDPR-compliant; Canadian data residency; SOC 2 |
| 4 | Over-reliance on AI Recommendations | High | High | All recommendations require human sign-off; UI surfaces confidence levels prominently; "not financial advice" disclaimer |
| 5 | Regulatory Non-Compliance (XAI) | Medium | High | Every score includes drill-down explanation; audit trail of inputs → metrics → scores; meets banking regulator XAI requirements |
| 6 | OCR Errors Propagating Into Scores | High | High | Confidence scores on each OCR-extracted field; low-confidence fields flagged before analysis proceeds |
| 7 | Model Drift / Score Degradation | Medium | Medium | Phase 3 continuous monitoring; automated metric tracking triggers model refresh |
| 8 | Customer Concentration Risk Missed | Medium | High | Explicit risk flag category in label schema; agent flags when top-N customer concentration exceeds 50% of revenue |
| 9 | Adverse Financial Outcomes from AI-Guided Decisions | Low | Critical | Positioned as readiness tool, not lending decision system; lender acceptance rate tracked; conditional approvals |
| 10 | Prompt Injection via Uploaded Documents | Low | High | Documents processed through sandboxed extraction pipeline; structured data (not raw text) used as context |

---

## 12. Core Metrics

**North Star Metric:** Funded SMBs / Month (leading proxy: Readiness Score Improvement over 90 days)

### Primary Metrics

| Metric | Definition | Target |
|---|---|---|
| Financial Package Accuracy Rate | % of AI-generated financial packages accepted by lenders without major revision | >85% within 6 months of launch |
| Time-to-Ready | From SMB signup to lender-ready financial package | <24 hrs vs. 2–3 week consultant baseline |

### Secondary Metrics

1. **Adoption & Engagement:** Monthly Active SMBs (MAU); Readiness Score completion rate; return visit rate within 30 days
2. **Quality & Trust:** Lender acceptance rate; AI vs. consultant accuracy delta; false positive rate on risk/compliance flags
3. **Business Outcomes:** Avg. loan size secured; SMB revenue growth 12 months post-funding; lender referral conversion rate
4. **Cost & Efficiency:** Cost per funded SMB; support ticket rate
5. **Revenue:** MRR/ARR

---

## 13. Pricing Strategy

- Displacing $100–$200/hr financial consultants creates compelling ROI: $99–$299/month subscription replaces $3K–$8K in consultant fees for a single financing round
- Lender-side monetization (charging banks/family offices a referral or API fee for pre-qualified deal flow) could create a dual-sided revenue model with higher LTV

---

## 14. Launch Plan

| Stage | Timeframe | Criteria to Exit |
|---|---|---|
| Internal Alpha (Friends & Family) | Month 5–6 | All major bugs resolved; core functionality works; latency <1 min average; security basics in place |
| Private Beta (Invite-Only, 5–7 companies) | Month 6–8 | Beta user satisfaction ≥80%; accuracy thresholds met; latency <30s in 90% of cases |
| Staged Launch (Graduated Rollout) | Month 9 | System stability; A/B tests on feature variants; moderate user base onboarded |
| General Availability | Post Month 9 | All GA criteria met (see below) |

### GA Go/No-Go Criteria

- **Accuracy:** No known critical issue where AI would consistently mislead users
- **UX:** Major usability complaints from beta resolved; responsive across common browsers
- **Latency & Scalability:** Handle 20 concurrent SMB analyses without degraded performance; 95th percentile analysis time <90 seconds
- **Security & Compliance:** Security audit passed; data encrypted; privacy policy in place; disclaimers on all AI outputs
- **Support Readiness:** Customer support channels ready

---

## 15. Open Questions

- Sector expansion beyond Canadian F&B in Phase 2 — which sectors to prioritize?
- Pitchbook / Sedar integration for industry benchmarks — procurement and data licensing
- QuickBooks / accounting software direct integrations — Phase 1 or Phase 2?
- Data residency requirements for US expansion
- Fine-tuning dataset size threshold — confirm 200 labeled cases is sufficient trigger
