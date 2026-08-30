import type { PageText } from '@/lib/types';

/**
 * Synthetic sample documents written for this project — entirely fictional and
 * therefore freely redistributable (no real company, no copyrighted filing).
 * They mimic the shape of a 10-K excerpt and an insurance benefits summary so
 * demo mode and the eval set have realistic, self-contained ground truth.
 *
 * Each page is dense enough that ~800-token chunking yields several chunks per
 * document, so retrieval, fusion, and page-level citations are exercised.
 */
export interface SampleDoc {
  filename: string;
  pages: PageText[];
}

const northwind: SampleDoc = {
  filename: 'Northwind-Industries-FY2024-excerpt.pdf',
  pages: [
    {
      page: 1,
      text: `Northwind Industries, Inc. — Annual Report Excerpt (Fiscal Year 2024).
Business Overview. Northwind Industries designs and manufactures industrial
automation equipment and provides related cloud software and services to
customers in manufacturing, logistics, and energy. The Company was founded in
1998 and is headquartered in Columbus, Ohio, with manufacturing facilities in
Ohio, Texas, and Guadalajara, Mexico. The Company operates in three reportable
segments: Automation Hardware, Cloud Software, and Field Services. Total revenue
for fiscal year 2024 was $1,250.4 million, an increase of 12.3% compared with
$1,113.6 million in fiscal year 2023. Net income for fiscal year 2024 was $184.2
million, or $3.41 per diluted share, compared with $150.7 million, or $2.79 per
diluted share, in the prior year. Gross margin was 41.5%, up from 39.8% in
fiscal year 2023, driven by a higher mix of software revenue and improved
manufacturing efficiency. As of December 31, 2024, the Company had cash and cash
equivalents of $612.9 million and total debt of $300.0 million. The Company
employed approximately 6,400 people worldwide at fiscal year end.`,
    },
    {
      page: 2,
      text: `Segment Results. The Automation Hardware segment generated revenue of
$742.7 million in fiscal year 2024, an increase of 5.1% year over year, and
represented 59% of total revenue. Segment operating margin was 18.2%. The Cloud
Software segment generated revenue of $275.1 million, an increase of 28.1% year
over year, and represented 22% of total revenue; net revenue retention in this
segment was 118%. The Field Services segment generated revenue of $232.6
million, an increase of 11.4% year over year, and represented 19% of total
revenue. Geographically, approximately 54% of revenue was generated in the
United States, 28% in Europe, the Middle East, and Africa, and 18% in Asia
Pacific. Backlog at fiscal year end was $486.0 million, compared with $421.3
million a year earlier. The Company introduced fourteen new hardware products
during the year and expanded its software platform to support predictive
maintenance workflows.`,
    },
    {
      page: 3,
      text: `Risk Factors. The following are the principal risk factors that could
materially affect the Company's business, financial condition, and results of
operations. Foreign exchange risk: approximately 46% of revenue is generated
outside the United States, and a strengthening U.S. dollar reduces reported
revenue and earnings when foreign currencies are translated into dollars. Supply
chain disruption: the Company depends on a limited number of suppliers for
certain semiconductor components, and shortages have in the past increased costs
and lengthened product lead times. Cybersecurity: because the Cloud Software
segment stores customer operational data, a security breach could result in
liability, remediation costs, and reputational harm. Competition: the automation
market is highly competitive, and several competitors have greater financial and
engineering resources. Customer concentration: the Company's ten largest
customers accounted for 31% of total revenue in fiscal year 2024, and the loss
of a major customer could reduce revenue significantly. Regulatory risk: changes
in trade policy and tariffs could increase the cost of imported components.`,
    },
    {
      page: 4,
      text: `Dividends and Capital Allocation. During fiscal year 2024 the Board of
Directors declared a quarterly cash dividend of $0.30 per share, for a total of
$1.20 per share for the year, representing an aggregate payout of $64.8 million.
The Company also repurchased $120.0 million of its common stock under a $400.0
million repurchase authorization approved by the Board in February 2024, leaving
$280.0 million available under the authorization at year end. The Company intends
to continue returning capital to shareholders while investing in research and
development, which totaled $138.5 million in fiscal year 2024, or 11.1% of total
revenue, compared with $121.0 million in the prior year. Capital expenditures
were $58.3 million, primarily for manufacturing automation and expansion of the
Texas facility.`,
    },
    {
      page: 5,
      text: `Management's Discussion — Liquidity and Outlook. The Company believes
that existing cash, cash flow from operations, and available borrowing capacity
under its $500.0 million revolving credit facility will be sufficient to meet
working capital, capital expenditure, and debt service requirements for at least
the next twelve months. Cash provided by operating activities was $246.7 million
in fiscal year 2024. The revolving credit facility matures in 2028 and was
undrawn at year end. For fiscal year 2025, management expects total revenue
growth of 8% to 11% and continued gross margin expansion of 50 to 100 basis
points, subject to the risk factors described above. Management also expects
Cloud Software to exceed 25% of total revenue by the end of fiscal year 2025.
These forward-looking statements are subject to risks and uncertainties, and
actual results may differ materially.`,
    },
  ],
};

const evergreen: SampleDoc = {
  filename: 'Evergreen-Health-Plan-Summary-of-Benefits.pdf',
  pages: [
    {
      page: 1,
      text: `Evergreen Health Plan — Summary of Benefits (Sample Policy).
Deductibles. The annual in-network deductible is $1,500 for an individual and
$3,000 for a family. The annual out-of-network deductible is $3,000 for an
individual and $6,000 for a family. The deductible is the amount you pay for
covered services before the plan begins to pay its share. Amounts you pay toward
the in-network deductible do not count toward the out-of-network deductible, and
amounts you pay toward the out-of-network deductible do not count toward the
in-network deductible. Preventive care, including annual physical examinations,
recommended immunizations, and routine screenings, is covered at 100% and is not
subject to the deductible when provided by an in-network provider.`,
    },
    {
      page: 2,
      text: `Cost Sharing and Out-of-Pocket Maximum. After you meet your deductible,
you pay coinsurance of 20% of the allowed amount for in-network covered services
and 40% for out-of-network covered services; the plan pays the remainder. The
annual out-of-pocket maximum is $6,000 for an individual and $12,000 for a
family for in-network care. Once the out-of-pocket maximum is reached, the plan
pays 100% of covered services for the remainder of the plan year. Premiums,
balance-billed charges from out-of-network providers, and services the plan does
not cover do not count toward the out-of-pocket maximum. The plan year runs from
January 1 through December 31.`,
    },
    {
      page: 3,
      text: `Office Visits and Physician Services. The copay to see a primary care
physician is $25 per visit, and the copay to see a specialist is $50 per visit.
These copays do not count toward the deductible but do count toward the
out-of-pocket maximum. Telehealth visits with an in-network provider have a $15
copay. A referral from your primary care physician is not required to see an
in-network specialist. Laboratory tests ordered during a covered visit are
subject to the deductible and coinsurance. Maternity care is covered the same as
any other medical condition, subject to the deductible and coinsurance, and
prenatal preventive visits are covered at 100% in network.`,
    },
    {
      page: 4,
      text: `Prescription Drugs. Prescription drugs are covered under a three-tier
formulary. Tier 1 generic drugs have a $10 copay, Tier 2 preferred brand drugs
have a $35 copay, and Tier 3 non-preferred brand drugs have a $60 copay. A
90-day supply obtained through the mail-order pharmacy is dispensed for two times
the applicable retail copay. Specialty drugs require prior authorization and must
be obtained through a designated specialty pharmacy. If a generic equivalent is
available and you choose the brand drug, you pay the brand copay plus the
difference in cost between the brand and the generic.`,
    },
    {
      page: 5,
      text: `Emergency Care, Exclusions, and Appeals. Emergency room visits have a
$300 copay per visit, which is waived if you are admitted to the hospital
directly from the emergency room. Urgent care visits have a $60 copay. The plan
does not cover cosmetic surgery, most dental care for adults, routine foot care,
or services determined not to be medically necessary. Prior authorization is
required for certain advanced imaging services, such as MRI and CT scans, and
for non-emergency inpatient hospital admissions. If a claim is denied, you have
the right to appeal the decision within 180 days of receiving the denial notice,
and you may request an external review by an independent organization after
exhausting the plan's internal appeal process. Definitions. "Allowed amount" is
the maximum amount on which payment is based for covered services; if an
out-of-network provider charges more than the allowed amount, you may have to pay
the difference, known as balance billing. "In-network" refers to providers who
have contracted with the plan to provide services at negotiated rates. Coverage
for dependent children continues until the end of the month in which the child
turns 26, regardless of student or marital status. To find an in-network
provider or to check whether a specific service requires prior authorization,
contact member services at the number printed on your identification card.`,
    },
  ],
};

export const SAMPLE_DOCS: SampleDoc[] = [northwind, evergreen];
