#!/usr/bin/env python3
"""Regression tests for deterministic financial normalization."""

from __future__ import annotations

import importlib.util
import sys
import unittest
from decimal import Decimal
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("financial_normalizer.py")
SPEC = importlib.util.spec_from_file_location("financial_normalizer", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Could not load {MODULE_PATH}")

normalizer = importlib.util.module_from_spec(SPEC)
sys.modules["financial_normalizer"] = normalizer
SPEC.loader.exec_module(normalizer)


class FinancialNormalizerRegressionTests(unittest.TestCase):
    def test_lions_gate_loose_fiscal_headers_keep_ending_years_and_balance_sheet(self) -> None:
        text = """LIONSGATE
WATER TREATMENT LTD.

### Profit and Loss Comparison
May 2023 - Apr. 2024 May 2022 - Apr. 2023 (PY)
Total Income 5,087,993.31 4,567,051.93
Total Cost of Goods Sold 2,169,848.14 2,318,708.28
GROSS PROFIT 2,918,145.17 2,248,343.65
Total Expenses 2,396,809.00 1,993,988.91

## Balance Sheet Comparison As of April 30, 2024
As of Apr. 30, 2024 As of Apr. 30, 2023 (PY)
Total Assets 3,019,868.86 2,766,911.48
Total Liabilities 1,017,679.62 1,175,521.41
Total Equity 2,002,189.24 1,591,390.07
Total Liabilities and Equity 3,019,868.86 2,766,911.48
"""
        parsed = normalizer.parse_financials(text, "lions-gate.pdf")
        content = normalizer.build_content(parsed)

        self.assertEqual(parsed.company_name, "Lions Gate Water Treatment Ltd.")
        self.assertEqual(parsed.income["Gross Revenue"].values[2024], Decimal("5087993.31"))
        self.assertEqual(parsed.income["Gross Revenue"].values[2023], Decimal("4567051.93"))
        self.assertNotIn(2022, parsed.income["Gross Revenue"].values)
        self.assertEqual(parsed.balance["Total Assets"].values[2024], Decimal("3019868.86"))
        self.assertEqual(parsed.balance["TL + SE"].values[2023], Decimal("2766911.48"))
        self.assertIn("### Balance Sheet", content)
        self.assertIn('Total Assets,"3,019,868.86","2,766,911.48"', content)

    def test_lions_gate_table_headers_keep_balance_sheet_continuation_rows(self) -> None:
        text = """# Lions Gate Water Treatment Ltd.

## Balance Sheet Comparison As of April 30, 2024
<table>
<tr><th></th><th colspan="2">NOTES</th><th>Total</th></tr>
<tr><th></th><th></th><th>As of Apr. 30, 2024</th><th>As of Apr. 30, 2023 (PY)</th></tr>
<tr><td>Total Assets</td><td></td><td>3,019,868.86</td><td>2,766,911.48</td></tr>
<tr><td>Total Liabilities</td><td></td><td>1,017,679.62</td><td>1,175,521.41</td></tr>
</table>
<table>
<tr><th></th><th>NOTES</th><th>Total</th></tr>
<tr><td></td><td>As of Apr. 30, 2024</td><td>As of Apr. 30, 2023 (PY)</td></tr>
<tr><td>Total Equity</td><td>2,002,189.24</td><td>1,591,390.07</td></tr>
<tr><td>Total Liabilities and Equity</td><td>$3,019,868.86</td><td>$2,766,911.48</td></tr>
</table>
"""
        parsed = normalizer.parse_financials(text, "lions-gate.pdf")

        self.assertEqual(parsed.company_name, "Lions Gate Water Treatment Ltd.")
        self.assertEqual(parsed.balance["Total Assets"].values[2024], Decimal("3019868.86"))
        self.assertEqual(parsed.balance["Shareholder Equity"].values[2024], Decimal("2002189.24"))
        self.assertEqual(parsed.balance["TL + SE"].values[2023], Decimal("2766911.48"))

    def test_great_pillow_dashes_become_zero_and_company_heading_is_trimmed(self) -> None:
        text = """# THE GREAT CANADIAN PILLOW COMPANY INC. FINANCIAL INFORMATION DECEMBER 31, 2025

## THE GREAT CANADIAN PILLOW COMPANY INC. BALANCE SHEET AS AT DECEMBER 31, 2025
<table>
<tr><th></th><th>Notes</th><th>2025</th><th>2024</th></tr>
<tr><th></th><th></th><th>$</th><th>$</th></tr>
<tr><td>Cash and bank</td><td></td><td>4,869</td><td>531</td></tr>
<tr><td>Accounts receivable</td><td>2</td><td>399,446</td><td>-</td></tr>
<tr><td>Inventory</td><td>2</td><td>1,417,048</td><td>447,327</td></tr>
<tr><td>Bank operating line of credit</td><td>2</td><td>588,500</td><td>-</td></tr>
<tr><td>Income taxes payable</td><td>2</td><td>18,328</td><td>-</td></tr>
<tr><td>Loan payable - current portion</td><td>2</td><td>75,177</td><td>-</td></tr>
<tr><td>Loan payable</td><td></td><td>346,177</td><td>-</td></tr>
<tr><td>Total Assets</td><td></td><td>2,680,694</td><td>980,946</td></tr>
<tr><td>Total Liabilities</td><td></td><td>2,548,695</td><td>1,100,018</td></tr>
<tr><td>100 common shares</td><td></td><td>100</td><td>100</td></tr>
<tr><td>Retained Earnings (Deficit)</td><td></td><td>131,899</td><td>(119,172)</td></tr>
<tr><td>Total Liabilities and Shareholder's Equity</td><td></td><td>2,680,694</td><td>980,946</td></tr>
</table>
"""
        parsed = normalizer.parse_financials(text, "FY2025 TGCPC.pdf")
        content = normalizer.build_content(parsed)

        self.assertEqual(parsed.company_name, "THE GREAT CANADIAN PILLOW COMPANY INC.")
        self.assertEqual(parsed.balance["Accounts receivable (net)"].values[2024], Decimal("0"))
        self.assertEqual(parsed.balance["Bank Indebtedness"].values[2024], Decimal("0"))
        self.assertEqual(parsed.balance["Income taxes payable"].values[2024], Decimal("0"))
        self.assertEqual(parsed.balance["Short-term Loans"].values[2024], Decimal("0"))
        self.assertEqual(parsed.balance["Long-term Loans"].values[2024], Decimal("0"))
        self.assertIn('Accounts receivable (net),"399,446",0', content)

    def test_dash_parsing_is_consistent_across_paths(self) -> None:
        self.assertEqual(normalizer.parse_decimal("-"), Decimal("0"))
        self.assertEqual(normalizer.parse_decimal("—"), Decimal("0"))
        self.assertEqual(normalizer.parse_decimal("–"), Decimal("0"))

    def test_paarizaat_empty_explicit_amount_cell_becomes_zero_for_ceba(self) -> None:
        text = """# PAARIZAAT INTERNATIONAL LTD. FINANCIAL STATEMENTS DECEMBER 31, 2024

## PAARIZAAT INTERNATIONAL LTD. BALANCE SHEET AS AT DECEMBER 31, 2024
<table>
<tr><th></th><th>Notes</th><th>2024</th><th>2023</th></tr>
<tr><th></th><th></th><th>$</th><th>$</th></tr>
<tr><td>Line of Credit- RBC</td><td></td><td>2,668,450</td><td>2,280,000</td></tr>
<tr><td>RBC loan - CEBA</td><td></td><td></td><td>40,000</td></tr>
<tr><td>Loans payable-BDC- current portion</td><td>3</td><td>250,480</td><td>215,500</td></tr>
<tr><td>Total Liabilities</td><td></td><td>4,965,049</td><td>4,591,294</td></tr>
<tr><td>Total Liabilities and Shareholder's Equity</td><td></td><td>8,393,837</td><td>7,600,335</td></tr>
</table>
"""
        parsed = normalizer.parse_financials(text, "Paarizaat 2024 FS_Input.pdf")
        content = normalizer.build_content(parsed)

        self.assertEqual(parsed.company_name, "PAARIZAAT INTERNATIONAL LTD.")
        self.assertEqual(parsed.balance["CEBA Loan payable"].values[2024], Decimal("0"))
        self.assertEqual(parsed.balance["CEBA Loan payable"].values[2023], Decimal("40000"))
        self.assertIn('CEBA Loan payable,0,"40,000"', content)

    def test_plural_statements_of_operations_parse_public_company_income_statement(self) -> None:
        text = """Premium Brands Holdings Corporation
Consolidated Statements of Operations
(in millions of Canadian dollars except per share amounts)
13 weeks 13 weeks 26 weeks 26 weeks
ended ended ended ended
Jun 27, Jun 28, Jun 27, Jun 28,
2026 2025 2026 2025
Revenue 2,375.7 1,880.7 4,426.7 3,526.6
Cost of goods sold 1,947.2 1,526.0 3,612.0 2,856.0
Gross profit before depreciation, amortization, and plant start-up and restructuring costs 428.5 354.7 814.7 670.6
Selling, general and administrative expenses before depreciation and
amortization 219.6 196.2 450.2 392.0
Operating profit before depreciation, amortization, and plant start-up and restructuring costs 225.0 173.8 396.2 308.9
Depreciation of capital assets 35.6 24.7 69.8 49.6
Amortization of intangible assets 8.3 5.4 16.6 11.4
Interest and other financing costs 44.2 44.7 88.2 86.6
Change in value of puttable interest in subsidiaries 0.5 1.0 1.0 2.0
Provision for income taxes (recovery)
Current 17.6 15.6 28.9 27.1
Deferred 0.6 0.8 (1.1) 0.3
Earnings 70.9 27.9 73.8 30.5

Consolidated Balance Sheets
Jun 27, Jun 28, Dec 27,
2026 2025 2025
Cash and cash equivalents 15.3 12.9 29.3
Accounts receivable 679.9 580.2 570.5
Inventories 1,392.1 1,010.5 1,045.8
Total assets 7,207.8 5,973.5 5,947.4
Long-term debt 2,035.6 1,837.4 1,813.4
Total liabilities 4,850.3 4,255.7 4,292.0
Share capital 2,428.0 1,727.5 1,732.5
Retained earnings (deficit) (138.2) (52.7) (123.3)

Notes to the Interim Condensed Consolidated Financial Statements
25. Held for sale and discontinued operations
Revenue 17.6 34.1 64.7 67.4
Cost of goods sold 15.6 26.9 56.4 54.5
Earnings 53.6 1.2 50.6 (2.3)
"""
        parsed = normalizer.parse_financials(text, "PBHC-Consolidated-FS-2026-q2.pdf")
        content = normalizer.build_content(parsed)

        self.assertEqual(parsed.income["Gross Revenue"].values[2026], Decimal("4426.7"))
        self.assertEqual(parsed.income["Gross Revenue"].values[2025], Decimal("3526.6"))
        self.assertEqual(parsed.income["Cost of Sales"].values[2026], Decimal("3612.0"))
        self.assertEqual(parsed.income["Gross Margin"].values[2025], Decimal("670.6"))
        self.assertEqual(parsed.income["SG&A"].values[2026], Decimal("450.2"))
        self.assertEqual(parsed.income["Depreciation"].values[2026], Decimal("86.4"))
        self.assertEqual(parsed.income["Operating Income"].values[2026], Decimal("396.2"))
        self.assertEqual(parsed.income["Interest"].values[2026], Decimal("88.2"))
        self.assertEqual(parsed.income["Corporate Tax"].values[2026], Decimal("27.8"))
        self.assertEqual(parsed.income["Net Income"].values[2025], Decimal("30.5"))
        self.assertIn('Gross Revenue,"4,426.70","3,526.60"', content)
        self.assertIn("### Income Statement", content)


if __name__ == "__main__":
    unittest.main()
