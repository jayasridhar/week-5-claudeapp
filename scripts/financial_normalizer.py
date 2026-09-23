#!/usr/bin/env python3
"""Deterministic financial statement normalizer.

Input: JSON on stdin with fileText and optional fileName.
Output: JSON with a markdown/CSV content field suitable for the existing app UI.
"""

from __future__ import annotations

import csv
import html
import io
import json
import re
import sys
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Iterable


MONEY_RE = re.compile(r"\(?-?\$?\s*\d[\d,]*(?:\.\d+)?\)?")
VALUE_RE = re.compile(r"\(?-?\$?\s*\d[\d,]*(?:\.\d+)?\)?|(?<!\w)[—–-](?!\w)")
YEAR_RE = re.compile(r"\b(20\d{2}|19\d{2})\b")


INCOME_MAP: list[tuple[str, str]] = [
    ("Cost of Sales", r"\b(cost\s+of\s+sales|cost\s+of\s+goods\s+sold|cogs|purchases?,?\s+packaging\s+and\s+printing)\b"),
    ("Gross Revenue", r"\b(gross\s+revenue|net\s+sales|sales|revenue|total\s+(revenue|income))\b"),
    ("Materials", r"\b(materials?|purchases?|cost\s+of\s+goods|cogs)\b"),
    ("Labour", r"\b(labou?r|wages?|salar(?:y|ies)|payroll)\b"),
    ("Variable Costs", r"\b(variable\s+costs?|direct\s+costs?)\b"),
    ("Fixed Costs", r"\b(fixed\s+costs?|occupancy|rent|utilities|insurance)\b"),
    ("Gross Margin", r"\b(gross\s+margin|gross\s+profit)\b"),
    ("Logistics", r"\b(logistics?|freight|shipping|delivery)\b"),
    ("SG&A", r"\b(sg&a|selling.*general|general.*administrative|administrative|office)\b"),
    ("Depreciation", r"\b(depreciation|amorti[sz]ation)\b"),
    ("Interest", r"\b(interest)\b"),
    ("Operating Costs", r"\b(operating\s+(costs?|expenses?)|total\s+expenses?)\b"),
    ("Operating Income", r"\b(operating\s+(income|loss)|income\s+from\s+operations)\b"),
    ("Corporate Tax", r"\b(corporate\s+tax|income\s+tax(?:es)?|tax\s+expense)\b"),
    ("Net Income", r"\b(net\s+(income|loss|earnings)|earnings\s+for\s+the\s+year)\b"),
    ("Beginning Retained Earnings", r"\b(beginning\s+retained\s+earnings|retained\s+earnings.*beginning)\b"),
    ("Ending Retained Earnings", r"\b(ending\s+retained\s+earnings|retained\s+earnings.*end)\b"),
]

ASSET_MAP: list[tuple[str, str]] = [
    ("Cash", r"\b(cash|cash\s+and\s+bank)\b"),
    ("Accounts receivable (net)", r"\b(accounts?\s+receivable|trade\s+receivables?)\b"),
    ("Inventory", r"\b(inventor(?:y|ies))\b"),
    ("Prepaid Expenses & Deposits", r"\b(prepaid|deposits?|sundry\s+receivable)\b"),
    ("Property & Equipment", r"\b(property|equipment|fixed\s+assets?|capital\s+assets?|leasehold|property,\s*plant\s+and\s+equipment)\b"),
    ("Due from Related Parties", r"\b(due\s+from\s+(related|shareholder)|receivable\s+from\s+(related|shareholder))\b"),
    ("Other Assets", r"\b(harmonized\s+sales\s+tax\s+recoverable|hst\s+recoverable|sales\s+tax\s+recoverable|incorporation\s+costs?)\b"),
    ("Total Assets", r"\b(total\s+assets?)\b"),
]

LIABILITY_MAP: list[tuple[str, str]] = [
    ("Bank Indebtedness", r"\b(bank\s+indebtedness|bank\s+loan|operating\s+loan|line\s+of\s+credit)\b"),
    ("Accounts Payable & Accrued Liabilities", r"\b(accounts?\s+payable|accrued\s+liabilit(?:y|ies)|trade\s+payables?|hst\s+payable)\b"),
    ("Income taxes payable", r"\b(income\s+tax(?:es)?\s+payable|tax(?:es)?\s+payable)\b"),
    ("Short-term Loans", r"\b(short[\s-]?term\s+loans?|current\s+portion|notes?\s+payable)\b"),
    ("Due to related parties", r"\b(due\s+to\s+related|payable\s+to\s+related|shareholder\s+loan|loan\s+payable\s+-\s+related\s+party|advances?\s+from\s+shareholder)\b"),
    ("CEBA Loan payable", r"\b(ceba)\b"),
    ("Long-term Loans", r"\b(long[\s-]?term\s+loans?|long[\s-]?term\s+debt|loan\s+payable)\b"),
    ("TL + SE", r"\b(total\s+liabilit(?:y|ies)\s+(and|&)\s+(shareholder(?:s|['’]s|s['’])?\s+)?equity)\b"),
    ("Total Liabilities", r"\b(total\s+liabilit(?:y|ies))\b"),
    ("Common Shares", r"\b(common\s+shares?|share\s+capital|capital\s+stock)\b"),
    ("Retained Earnings", r"\b(retained\s+earnings|deficit)\b"),
    ("Shareholder Equity", r"\b(shareholder(?:s|['’]s|s['’])?\s+equity|stockholder(?:s|['’]s|s['’])?\s+equity|total\s+equity)\b"),
]

AGGREGATE_LABELS = {
    "Materials",
    "Labour",
    "Variable Costs",
    "Fixed Costs",
    "Logistics",
    "SG&A",
    "Prepaid Expenses & Deposits",
    "Other Assets",
    "Accounts Payable & Accrued Liabilities",
    "Due to related parties",
    "Long-term Loans",
}

EXPENSE_LABELS = {
    "Cost of Sales",
    "Materials",
    "Labour",
    "Variable Costs",
    "Fixed Costs",
    "Logistics",
    "SG&A",
    "Depreciation",
    "Interest",
    "Operating Costs",
    "Corporate Tax",
}

INCOME_ORDER = [
    "Gross Revenue",
    "Materials",
    "Labour",
    "Variable Costs",
    "Fixed Costs",
    "Cost of Sales",
    "Gross Margin",
    "Logistics",
    "SG&A",
    "Depreciation",
    "Interest",
    "Operating Costs",
    "Operating Income",
    "Corporate Tax",
    "Net Income",
    "EBITDA",
    "Beginning Retained Earnings",
    "Ending Retained Earnings",
]

BALANCE_ORDER = [
    "Cash",
    "Accounts receivable (net)",
    "Inventory",
    "Prepaid Expenses & Deposits",
    "Property & Equipment",
    "Due from Related Parties",
    "Other Assets",
    "Total Assets",
    "Bank Indebtedness",
    "Accounts Payable & Accrued Liabilities",
    "Income taxes payable",
    "Short-term Loans",
    "Due to related parties",
    "CEBA Loan payable",
    "Long-term Loans",
    "Total Liabilities",
    "Common Shares",
    "Retained Earnings",
    "Shareholder Equity",
    "TL + SE",
]

CASH_FLOW_ORDER = [
    "Net income",
    "Depreciation and amortization",
    "Accounts receivable",
    "Inventories",
    "Prepaid and deposits",
    "Accounts payable and accrued liabilities",
    "Income taxes payable",
    "Cash provided by (used in) operating activities",
    "Acquisition of property and equipment",
    "Cash used in investing activities",
    "Proceeds from (repayment of) bank loan",
    "Advances to related corporations",
    "Dividends paid",
    "Advances of shareholder's loan",
    "Cash used for financing activities",
    "Increase (decrease) in cash",
    "Cash - Beginning of year",
    "Cash - End of year",
]

@dataclass
class Row:
    label: str
    values: dict[int, Decimal] = field(default_factory=dict)
    source_label: str = ""


@dataclass
class ParsedFinancials:
    company_name: str = "Unknown"
    currency: str = "Unknown (not specified)"
    unit: str = "Amounts in actual currency unless source states otherwise"
    income: dict[str, Row] = field(default_factory=dict)
    balance: dict[str, Row] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


def parse_decimal(raw: str) -> Decimal | None:
    value = raw.strip()
    if not value:
        return None
    if value in {"-", "—", "–"}:
        return Decimal("0")
    is_negative = value.startswith("(") and value.endswith(")")
    value = re.sub(r"(?i)\b(cad|cdn|usd|inr|rs\.?)\b", "", value)
    value = value.replace("$", "").replace(",", "").replace("%", "").replace("(", "").replace(")", "").strip()
    if not re.fullmatch(r"-?\d+(?:\.\d+)?", value):
        return None
    try:
        parsed = Decimal(value)
    except InvalidOperation:
        return None
    if is_negative:
        parsed = -abs(parsed)
    return parsed


def decimal_to_string(value: Decimal | None, percent: bool = False) -> str:
    if value is None:
        return ""
    if percent:
        q = value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
        return f"{q:f}%"
    if value == value.to_integral():
        return str(int(value))
    q = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{q:f}"


def decimal_to_display(value: Decimal | None) -> str:
    raw = decimal_to_string(value)
    if raw == "":
        return ""
    try:
        parsed = Decimal(raw)
    except InvalidOperation:
        return raw
    sign = "-" if parsed < 0 else ""
    absolute = abs(parsed)
    if absolute == absolute.to_integral():
        return f"{sign}{int(absolute):,}"
    whole, fraction = f"{absolute.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):f}".split(".")
    return f"{sign}{int(whole):,}.{fraction}"


def currency_symbol(currency: str) -> str:
    if currency == "INR":
        return "₹"
    return "$"


def clean_label(label: str) -> str:
    label = re.sub(r"<[^>]+>", " ", label)
    label = re.sub(r"[*_`#]", "", label)
    label = re.sub(r"\s+", " ", label)
    return label.strip(" ,:-\t")


def detect_currency(text: str) -> str:
    lower = text.lower()
    if re.search(r"\binr\b|\brs\.?\b|\brupees?\b|\blakhs?\b|\bcrores?\b", lower):
        return "INR"
    if re.search(r"\busd\b|u\.s\. dollars?|us dollars?", lower):
        return "USD"
    if re.search(r"\bcad\b|\bcdn\b|canadian dollars?|\bcanada\b|\bontario\b", lower):
        return "CAD"
    if "$" in text:
        return "Unknown ($ symbol only)"
    return "Unknown (not specified)"


def detect_unit(text: str, currency: str) -> str:
    lower = text.lower()
    if re.search(r"\b(in thousands|000s|thousands of dollars|cad\s*000)", lower):
        return f"Amounts in {currency} 000s" if currency != "Unknown (not specified)" else "Amounts in 000s"
    if re.search(r"\b(in millions|millions of dollars)", lower):
        return f"Amounts in {currency} millions" if currency != "Unknown (not specified)" else "Amounts in millions"
    return f"Amounts in actual {currency}" if currency != "Unknown (not specified)" else "Amounts in actual currency unless source states otherwise"


def detect_company_name(text: str, file_name: str) -> str:
    recent_logo_lines: list[str] = []
    for line in text.splitlines()[:80]:
        heading_match = re.match(r"^#{1,3}\s+(.+)$", line.strip())
        if not heading_match:
            continue
        cleaned = clean_label(heading_match.group(1))
        if not cleaned or len(cleaned) > 90:
            continue
        if re.search(r"\b(statement|balance|income|cash|assets|liabilities|unaudited|compiled|report|table\s+of\s+contents)\b", cleaned, re.I):
            continue
        if re.search(r"\b(inc\.?|corp\.?|corporation|ltd\.?|limited|company|co\.?)\b", cleaned, re.I):
            return clean_company_heading(cleaned)

    for line in text.splitlines()[:80]:
        cleaned = clean_label(line)
        if not cleaned or len(cleaned) > 90:
            continue
        if re.search(r"\b(statement|balance|income|cash|assets|liabilities|unaudited|compiled|report)\b", cleaned, re.I):
            continue
        if (
            re.search(r"\b(inc\.?|corp\.?|corporation|ltd\.?|limited|company|co\.?)\b", cleaned, re.I)
            and cleaned.isupper()
            and recent_logo_lines
        ):
            prefix = clean_label(recent_logo_lines[-1])
            if prefix and not re.search(r"\b(statement|balance|income|cash|assets|liabilities|unaudited|compiled|report)\b", prefix, re.I):
                return title_company_name(f"{prefix} {cleaned}")
        if re.search(r"\b(inc\.?|corp\.?|corporation|ltd\.?|limited|company|co\.?)\b", cleaned, re.I):
            return clean_company_heading(cleaned)
        if cleaned.isupper() and re.search(r"[A-Z]{3,}", cleaned):
            recent_logo_lines.append(cleaned)
            recent_logo_lines = recent_logo_lines[-3:]
    return re.sub(r"\.[^.]+$", "", file_name).strip() or "Unknown"


def clean_company_heading(name: str) -> str:
    name = re.sub(
        r"\s+\b(financial\s+information|financial\s+statements?|compiled\s+financial\s+information)\b.*$",
        "",
        name,
        flags=re.I,
    )
    return clean_label(name)


def title_company_name(name: str) -> str:
    words = re.sub(r"\s+", " ", name).strip().split()
    titled: list[str] = []
    for word in words:
        bare = word.strip(".,")
        suffix = word[len(bare):]
        if re.fullmatch(r"(?i)inc", bare):
            titled.append("Inc." if suffix == "." else "Inc" + suffix)
        elif re.fullmatch(r"(?i)ltd", bare):
            titled.append("Ltd." if suffix == "." else "Ltd" + suffix)
        elif re.fullmatch(r"(?i)corp", bare):
            titled.append("Corp." if suffix == "." else "Corp" + suffix)
        elif re.fullmatch(r"(?i)co", bare):
            titled.append("Co." if suffix == "." else "Co" + suffix)
        elif bare.upper() == "LIONSGATE":
            titled.extend(["Lions", "Gate"])
        else:
            titled.append(bare[:1].upper() + bare[1:].lower() + suffix)
    return " ".join(titled)


def html_tables_to_tab_rows(text: str) -> str:
    def clean_cell(cell: str) -> str:
        cell = re.sub(r"<[^>]+>", " ", cell)
        cell = html.unescape(cell)
        cell = cell.replace("\xa0", " ")
        return re.sub(r"\s+", " ", cell).strip()

    def replace_row(match: re.Match[str]) -> str:
        row_html = match.group(1)
        cells = [
            clean_cell(cell_match.group(2))
            for cell_match in re.finditer(r"<(td|th)\b[^>]*>(.*?)</\1>", row_html, re.I | re.S)
        ]
        if not cells:
            return "\n"
        return "\n" + "\t".join(cells) + "\n"

    converted = re.sub(r"<tr\b[^>]*>(.*?)</tr>", replace_row, text, flags=re.I | re.S)
    converted = re.sub(r"</?table\b[^>]*>", "\n", converted, flags=re.I)
    return converted


def split_row(line: str) -> list[str] | None:
    stripped = line.strip()
    if not stripped:
        return None
    if stripped.startswith("|") and "|" in stripped[1:]:
        cells = [c.strip() for c in stripped.strip("|").split("|")]
        if len(cells) >= 2 and not all(re.fullmatch(r"[-:\s]+", c) for c in cells):
            return cells
    if "\t" in stripped:
        cells = [c.strip() for c in stripped.split("\t")]
        if len(cells) >= 2:
            return cells
    if "," in stripped:
        try:
            cells = next(csv.reader([stripped]))
        except csv.Error:
            return None
        cells = [c.strip() for c in cells]
        if len(cells) >= 2 and MONEY_RE.search(stripped) and any(
            re.search(r"\d\s+\$?\s*\d", cell) or re.search(r"\$\s*\d", cell)
            for cell in cells
        ):
            return None
        if cells and MONEY_RE.search(cells[0]):
            return None
        if len(cells) >= 2:
            return cells
    return None


def comparative_years_from_line(line: str) -> dict[int, int]:
    months = r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
    fiscal_range_years = [
        int(match.group(1))
        for match in re.finditer(
            rf"\b(?:{months})\.?\s+\d{{4}}\s*[-–]\s*(?:{months})\.?\s+(\d{{4}})",
            line,
            re.I,
        )
    ]
    if len(fiscal_range_years) >= 2:
        return {idx + 1: year for idx, year in enumerate(fiscal_range_years[:2])}

    years: list[int] = []
    for year in reversed([int(match) for match in YEAR_RE.findall(line)]):
        if year not in years:
            years.append(year)
        if len(years) == 2:
            break
    if len(years) < 2:
        return {}
    return {idx + 1: year for idx, year in enumerate(reversed(years))}


def is_statement_year_header(line: str) -> bool:
    return bool(
        re.search(
            r"\b(balance\s+sheet|statement\s+of|year\s+ended|as\s+(at|of)|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b",
            line,
            re.I,
        )
    )


def sequential_values_from_cells(cells: list[str], label_index: int, years: dict[int, int]) -> dict[int, Decimal]:
    ordered_years = [year for _, year in sorted(years.items())]
    if not ordered_years:
        return {}

    values: list[Decimal] = []
    for cell in cells[label_index + 1:]:
        raw = cell.strip()
        if raw in {"-", "—", "–"}:
            values.append(Decimal("0"))
            continue
        cleaned = clean_label(cell)
        if not cleaned or cleaned in {"$", "CAD", "USD", "INR"} or YEAR_RE.fullmatch(cleaned):
            continue
        parsed = parse_decimal(raw)
        if parsed is not None:
            values.append(parsed)

    if len(values) < min(2, len(ordered_years)):
        return {}
    return {
        year: value
        for year, value in zip(ordered_years, values)
    }


def looks_like_note_reference(cells: list[str], label_index: int) -> bool:
    if label_index + 2 >= len(cells):
        return False
    note_candidate = clean_label(cells[label_index + 1])
    following_value = parse_decimal(cells[label_index + 2])
    if not re.fullmatch(r"\d{1,3}", note_candidate) or following_value is None:
        return False
    note_number = int(note_candidate)
    return 100 <= note_number <= 999


def fill_empty_amount_cells_as_zero(
    values: dict[int, Decimal],
    cells: list[str],
    years: dict[int, int],
    label_index: int,
) -> dict[int, Decimal]:
    if not values:
        return values
    filled = dict(values)
    for idx, year in years.items():
        if year in filled or idx >= len(cells) or idx <= label_index:
            continue
        if clean_label(cells[idx]) == "":
            filled[year] = Decimal("0")
    return filled


def split_loose_financial_line(line: str, current_years: dict[int, int]) -> tuple[str, dict[int, Decimal]] | None:
    if not current_years:
        return None
    if line.lstrip().startswith("#") or re.search(r"\b(as at|for the year ended|statement of|pagefooter|pagenumber)\b", line, re.I):
        return None
    matches = [match for match in VALUE_RE.finditer(line) if match.group(0).strip()]
    ordered_years = [year for _, year in sorted(current_years.items())]
    if len(matches) < min(2, len(ordered_years)):
        return None

    label = clean_label(line[: matches[0].start()])
    if not label:
        return None

    values: dict[int, Decimal] = {}
    for year, match in zip(ordered_years, matches[: len(ordered_years)]):
        raw_value = match.group(0).strip()
        value = Decimal("0") if raw_value in {"-", "—", "–"} else parse_decimal(raw_value)
        if value is not None:
            values[year] = value

    return (label, values) if values else None


def row_years(cells: list[str]) -> dict[int, int]:
    years: dict[int, int] = {}
    for idx, cell in enumerate(cells):
        matches = YEAR_RE.findall(cell)
        if matches:
            years[idx] = int(matches[-1])
    return years


def is_year_header_row(cells: list[str]) -> bool:
    nonempty = [clean_label(cell) for cell in cells if clean_label(cell)]
    return bool(nonempty) and all(
        YEAR_RE.fullmatch(cell) or cell in {"$", "CAD", "USD", "INR"}
        for cell in nonempty
    )


def is_period_header_row(cells: list[str]) -> bool:
    nonempty = [clean_label(cell) for cell in cells if clean_label(cell)]
    return bool(nonempty) and all(YEAR_RE.search(cell) for cell in nonempty)


def statement_years(cells: list[str], years: dict[int, int]) -> dict[int, int]:
    """Align detected year columns to data rows.

    Document Intelligence sometimes emits a header row as just "2025 2024",
    while the data rows are "Label 2025-value 2024-value". Balance sheets
    with a Notes column can also arrive as "Notes 2025 2024", while data rows
    are "Label Notes 2025-value 2024-value".
    """
    if not years:
        return years

    first = clean_label(cells[0]).lower() if cells else ""
    if first in {"note", "notes"}:
        return {idx + 1: year for idx, year in years.items()}
    if is_year_header_row(cells):
        if first == "":
            return years
        return {idx + 1: year for idx, year in years.items()}
    return years


def aligns_with_notes_total_header(cells: list[str], previous_cells: list[str] | None) -> bool:
    if not previous_cells or len(previous_cells) != len(cells):
        return False
    previous = [clean_label(cell).lower() for cell in previous_cells]
    current = [clean_label(cell).lower() for cell in cells]
    return (
        any(cell in {"note", "notes"} for cell in previous)
        and any(cell == "total" for cell in previous)
        and current
        and all(YEAR_RE.search(cell) for cell in current if cell)
    )


def classify_section(line: str, current: str | None) -> str | None:
    lower = line.lower()
    is_heading = line.lstrip().startswith("#")
    if (
        (is_heading and "notes to financial information" in lower)
        or re.match(r"#+\s*note\b", lower)
        or re.match(r"note\s+\d", lower)
    ):
        return "notes"
    if current == "notes":
        return "notes"
    if "balance sheet" in lower or "statement of financial position" in lower:
        return "balance"
    if "cash flow" in lower:
        return "cashflow"
    if (
        "income statement" in lower
        or "statement of income" in lower
        or "statement of operations" in lower
        or "profit and loss" in lower
        or "statement of earnings" in lower
        or "statement of loss" in lower
        or "statement of revenue" in lower
        or "statement of revenues" in lower
    ):
        return "income"
    if "retained earnings" in lower:
        return current or "income"
    if re.fullmatch(r"\s*assets?\s*", lower):
        return "balance"
    if re.fullmatch(r"\s*liabilities.*", lower):
        return "balance"
    return current


def match_label(label: str, mapping: list[tuple[str, str]]) -> str | None:
    lower = label.lower()
    for normalized, pattern in mapping:
        if re.search(pattern, lower):
            return normalized
    return None


def first_label_cell(cells: list[str]) -> tuple[int, str] | None:
    for idx, cell in enumerate(cells):
        label = clean_label(cell)
        if not label:
            continue
        if YEAR_RE.fullmatch(label):
            continue
        if parse_decimal(label) is not None:
            continue
        if label in {"$", "CAD", "USD", "INR"}:
            continue
        return idx, label
    return None


def infer_values_from_cells(cells: list[str], years: dict[int, int]) -> dict[int, Decimal]:
    values: dict[int, Decimal] = {}
    if years:
        for idx, year in years.items():
            if idx < len(cells):
                parsed = parse_decimal(cells[idx])
                if parsed is not None:
                    values[year] = parsed
        return values

    # Fallback for rows where the header was detected previously: callers pass
    # a synthetic cells/year map. If no years exist, there is nothing reliable.
    return values


def upsert_row(rows: dict[str, Row], label: str, values: dict[int, Decimal], source_label: str) -> None:
    if not values:
        return
    row = rows.setdefault(label, Row(label=label, source_label=source_label))
    if label in AGGREGATE_LABELS and row.source_label and row.source_label != source_label:
        if clean_label(source_label).lower().startswith("total "):
            row.values.update(values)
        elif clean_label(row.source_label).lower().startswith("total "):
            return
        else:
            for year, value in values.items():
                row.values[year] = row.values.get(year, Decimal("0")) + value
    else:
        row.values.update(values)
    if not row.source_label:
        row.source_label = source_label


def normalize_income_values(label: str, values: dict[int, Decimal]) -> dict[int, Decimal]:
    if label not in EXPENSE_LABELS:
        return values
    return {year: abs(value) for year, value in values.items()}


def parse_financials(text: str, file_name: str) -> ParsedFinancials:
    text = html_tables_to_tab_rows(text)
    parsed = ParsedFinancials()
    parsed.currency = detect_currency(text)
    parsed.unit = detect_unit(text, parsed.currency)
    parsed.company_name = detect_company_name(text, file_name)

    current_section: str | None = None
    current_years: dict[int, int] = {}
    previous_cells: list[str] | None = None
    income_context: str | None = None

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        next_section = classify_section(line, current_section)
        if next_section != current_section and next_section in {"income", "balance", "cashflow", "notes"}:
            current_years = {}
            previous_cells = None
            income_context = None
        current_section = next_section
        cells = split_row(line)
        inferred_years = comparative_years_from_line(line)
        if not cells and inferred_years and current_section in {"income", "balance", "cashflow"} and is_statement_year_header(line):
            current_years = inferred_years
            previous_cells = None
            continue

        label_info: tuple[int, str] | None = None
        if not cells:
            if inferred_years and current_section in {"income", "balance", "cashflow"} and is_statement_year_header(line):
                current_years = inferred_years
                previous_cells = None
                continue
            if current_section == "income" and clean_label(line).lower() == "expenses":
                income_context = "expenses"
                continue
            loose_years = YEAR_RE.findall(line)
            if loose_years and not re.search(r"[A-Za-z]", line):
                current_years = {idx + 1: int(year) for idx, year in enumerate(loose_years)}
                continue
            loose = split_loose_financial_line(line, current_years)
            if loose:
                label, values = loose
            else:
                continue
        else:
            years_in_row = row_years(cells)
            first_label = first_label_cell(cells)
            first_cell_has_money = bool(cells and MONEY_RE.search(cells[0]))
            if len(years_in_row) >= 1 and (not first_cell_has_money or is_year_header_row(cells) or is_period_header_row(cells)) and (
                not first_label or not match_label(first_label[1], INCOME_MAP + ASSET_MAP + LIABILITY_MAP)
            ):
                filtered_years = statement_years(cells, years_in_row)
                if aligns_with_notes_total_header(cells, previous_cells):
                    filtered_years = {idx + 2: year for idx, year in years_in_row.items()}
                if previous_cells and len(previous_cells) == len(cells):
                    has_statement_type_headers = any(
                        re.search(r"\b(forecast|proforma|actual)\b", cell, re.I)
                        for cell in previous_cells
                    )
                    if has_statement_type_headers:
                        filtered_years = {
                            idx: year
                            for idx, year in filtered_years.items()
                            if idx < len(previous_cells) and re.search(r"\b(proforma|actual)\b", previous_cells[idx], re.I)
                        }
                current_years = filtered_years or statement_years(cells, years_in_row)
                previous_cells = cells
                continue

            label_info = first_label
            values: dict[int, Decimal] = {}
            if current_years:
                for idx, year in current_years.items():
                    if idx < len(cells):
                        value = parse_decimal(cells[idx])
                        if value is not None:
                            values[year] = value
                if label_info and match_label(label_info[1], INCOME_MAP + ASSET_MAP + LIABILITY_MAP):
                    values = fill_empty_amount_cells_as_zero(values, cells, current_years, label_info[0])
                should_try_sequential_values = (
                    min(current_years.keys(), default=0) <= 1
                    or (max(current_years.keys(), default=0) >= len(cells) and len(cells) == len(current_years) + 1)
                )
                if (
                    label_info
                    and should_try_sequential_values
                    and not looks_like_note_reference(cells, label_info[0])
                    and len(values) < min(2, len(current_years))
                ):
                    sequential_values = sequential_values_from_cells(cells, label_info[0], current_years)
                    if len(sequential_values) > len(values):
                        values = sequential_values
            else:
                # Handle compact rows such as "Revenue 2025 100 2024 90".
                numbers = MONEY_RE.findall(line)
                years = YEAR_RE.findall(line)
                if len(years) >= 1 and len(numbers) >= len(years):
                    for y, n in zip(years, numbers[-len(years):]):
                        value = parse_decimal(n)
                        if value is not None:
                            values[int(y)] = value

            if not label_info:
                if current_years:
                    ordered_years = [year for _, year in sorted(current_years.items())]
                    money_values = [parse_decimal(cell) for cell in cells if parse_decimal(cell) is not None]
                    if money_values:
                        values = {
                            year: value
                            for year, value in zip(ordered_years, money_values)
                            if value is not None
                        }
                if current_section == "income" and income_context == "expenses" and values:
                    upsert_row(parsed.income, "Operating Costs", normalize_income_values("Operating Costs", values), "Expenses subtotal")
                    income_context = None
                previous_cells = cells
                continue

            _, label = label_info

        if not values:
            if current_section == "income" and label_info:
                normalized_heading = clean_label(label_info[1]).lower()
                if normalized_heading == "expenses":
                    income_context = "expenses"
            previous_cells = cells
            continue

        if current_section in {"cashflow", "notes"}:
            previous_cells = cells
            continue

        income_label = match_label(label, INCOME_MAP)
        balance_label = match_label(label, ASSET_MAP + LIABILITY_MAP)

        if current_section == "income" and income_label:
            upsert_row(parsed.income, income_label, normalize_income_values(income_label, values), label)
        elif current_section == "balance" and balance_label:
            upsert_row(parsed.balance, balance_label, values, label)
        elif current_section is None and income_label and not balance_label:
            upsert_row(parsed.income, income_label, values, label)
        elif current_section is None and balance_label:
            upsert_row(parsed.balance, balance_label, values, label)

        previous_cells = cells

    derive_missing_rows(parsed)
    return parsed


def get_value(rows: dict[str, Row], label: str, year: int) -> Decimal | None:
    return rows.get(label, Row(label)).values.get(year)


def set_derived(rows: dict[str, Row], label: str, year: int, value: Decimal | None) -> None:
    if value is None:
        return
    row = rows.setdefault(label, Row(label=label, source_label="computed"))
    if year not in row.values:
        row.values[year] = value


def sum_present(rows: dict[str, Row], labels: Iterable[str], year: int) -> Decimal | None:
    values = [get_value(rows, label, year) for label in labels]
    present = [v for v in values if v is not None]
    if not present:
        return None
    return sum(present, Decimal("0"))


def years_for(parsed: ParsedFinancials) -> list[int]:
    years = set()
    for source in (parsed.income, parsed.balance):
        for row in source.values():
            years.update(row.values)
    return sorted(years, reverse=True)


def derive_missing_rows(parsed: ParsedFinancials) -> None:
    for year in years_for(parsed):
        revenue = get_value(parsed.income, "Gross Revenue", year)
        cost_of_sales = get_value(parsed.income, "Cost of Sales", year)
        if cost_of_sales is None:
            cost_of_sales = sum_present(parsed.income, ["Materials", "Labour", "Variable Costs", "Fixed Costs"], year)
            set_derived(parsed.income, "Cost of Sales", year, cost_of_sales)

        gross_margin = get_value(parsed.income, "Gross Margin", year)
        if revenue is None and cost_of_sales is not None and gross_margin is not None:
            set_derived(parsed.income, "Gross Revenue", year, cost_of_sales + gross_margin)
            revenue = get_value(parsed.income, "Gross Revenue", year)

        if gross_margin is None and revenue is not None and cost_of_sales is not None:
            set_derived(parsed.income, "Gross Margin", year, revenue - cost_of_sales)

        operating_costs = get_value(parsed.income, "Operating Costs", year)
        if operating_costs is None:
            operating_costs = sum_present(parsed.income, ["Logistics", "SG&A", "Depreciation", "Interest"], year)
            set_derived(parsed.income, "Operating Costs", year, operating_costs)

        operating_income = get_value(parsed.income, "Operating Income", year)
        gross_margin = get_value(parsed.income, "Gross Margin", year)
        if operating_income is None and gross_margin is not None and operating_costs is not None:
            set_derived(parsed.income, "Operating Income", year, gross_margin - operating_costs)

        net_income = get_value(parsed.income, "Net Income", year)
        tax = get_value(parsed.income, "Corporate Tax", year) or Decimal("0")
        operating_income = get_value(parsed.income, "Operating Income", year)
        if net_income is None and operating_income is not None:
            set_derived(parsed.income, "Net Income", year, operating_income - tax)
            net_income = get_value(parsed.income, "Net Income", year)

        depreciation = get_value(parsed.income, "Depreciation", year) or Decimal("0")
        interest = get_value(parsed.income, "Interest", year) or Decimal("0")
        if net_income is not None:
            set_derived(parsed.income, "EBITDA", year, net_income + interest + depreciation + tax)

        total_assets = get_value(parsed.balance, "Total Assets", year)
        if total_assets is None:
            total_assets = sum_present(
                parsed.balance,
                [
                    "Cash",
                    "Accounts receivable (net)",
                    "Inventory",
                    "Prepaid Expenses & Deposits",
                    "Property & Equipment",
                    "Due from Related Parties",
                    "Other Assets",
                ],
                year,
            )
            set_derived(parsed.balance, "Total Assets", year, total_assets)

        total_liabilities = get_value(parsed.balance, "Total Liabilities", year)
        if total_liabilities is None:
            total_liabilities = sum_present(
                parsed.balance,
                [
                    "Bank Indebtedness",
                    "Accounts Payable & Accrued Liabilities",
                    "Income taxes payable",
                    "Short-term Loans",
                    "Due to related parties",
                    "CEBA Loan payable",
                    "Long-term Loans",
                ],
                year,
            )
            set_derived(parsed.balance, "Total Liabilities", year, total_liabilities)

        equity = get_value(parsed.balance, "Shareholder Equity", year)
        if equity is None:
            equity = sum_present(parsed.balance, ["Common Shares", "Retained Earnings"], year)
            set_derived(parsed.balance, "Shareholder Equity", year, equity)

        total_liabilities = get_value(parsed.balance, "Total Liabilities", year)
        equity = get_value(parsed.balance, "Shareholder Equity", year)
        if total_liabilities is not None and equity is not None:
            set_derived(parsed.balance, "TL + SE", year, total_liabilities + equity)


def pct(numerator: Decimal | None, denominator: Decimal | None) -> Decimal | None:
    if denominator in (None, Decimal("0")):
        return None
    if numerator is None:
        return Decimal("0")
    return numerator / denominator * Decimal("100")


def yoy(current: Decimal | None, prior: Decimal | None) -> Decimal | None:
    if current is None or prior in (None, Decimal("0")):
        return None
    return current / prior * Decimal("100") - Decimal("100")


def table_to_csv(rows: list[list[str]]) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerows(rows)
    return out.getvalue().strip()


def build_statement_table(
    rows: dict[str, Row],
    order: list[str],
    selected_years: list[int],
    vertical_base_label: str,
    currency: str,
) -> list[list[str]]:
    latest = selected_years[0] if selected_years else None
    prior = selected_years[1] if len(selected_years) > 1 else None
    header = ["Account", *[str(y) for y in selected_years]]
    header += [f"Vertical {y} %" for y in selected_years]
    if latest and prior:
        header.append(f"Horizontal {latest} vs {prior} %")

    output = [
        header,
        ["", *["Full year" for _ in selected_years], *["" for _ in selected_years], *["" for _ in ([1] if latest and prior else [])]],
        ["", *[currency_symbol(currency) for _ in selected_years], *["%" for _ in selected_years], *["%" for _ in ([1] if latest and prior else [])]],
    ]
    for label in order:
        row = rows.get(label)
        if not row:
            continue
        values = [row.values.get(year) for year in selected_years]
        if vertical_base_label == "__balance_sheet__":
            if label in {
                "Bank Indebtedness",
                "Accounts Payable & Accrued Liabilities",
                "Income taxes payable",
                "Short-term Loans",
                "Due to related parties",
                "CEBA Loan payable",
                "Long-term Loans",
            }:
                base_label = "Total Liabilities"
            elif label in {"Common Shares", "Retained Earnings"}:
                base_label = "Shareholder Equity"
            else:
                base_label = "Total Assets"
        else:
            base_label = vertical_base_label
        verticals = [pct(row.values.get(year), get_value(rows, base_label, year)) for year in selected_years]
        out_row = [label, *[decimal_to_display(v) for v in values], *[decimal_to_string(v, percent=True) for v in verticals]]
        if latest and prior:
            out_row.append(decimal_to_string(yoy(row.values.get(latest), row.values.get(prior)), percent=True))
        output.append(out_row)
    return output


def delta(rows: dict[str, Row], label: str, current: int, prior: int, reverse: bool = False) -> Decimal | None:
    current_value = get_value(rows, label, current)
    prior_value = get_value(rows, label, prior)
    if current_value is None:
        return None
    if prior_value is None:
        prior_value = Decimal("0")
    return (prior_value - current_value) if reverse else (current_value - prior_value)


def build_cash_flow(parsed: ParsedFinancials, selected_years: list[int]) -> list[list[str]]:
    header = ["Account", *[str(y) for y in selected_years]]
    rows: dict[str, dict[int, Decimal | None]] = {label: {} for label in CASH_FLOW_ORDER}

    for index in range(len(selected_years) - 1, -1, -1):
        year = selected_years[index]
        prior = selected_years[index + 1] if index + 1 < len(selected_years) else None
        rows["Net income"][year] = get_value(parsed.income, "Net Income", year)
        rows["Depreciation and amortization"][year] = get_value(parsed.income, "Depreciation", year)

        comparison_year = prior
        rows["Accounts receivable"][year] = delta(parsed.balance, "Accounts receivable (net)", year, comparison_year, reverse=True) if comparison_year is not None else -(get_value(parsed.balance, "Accounts receivable (net)", year) or Decimal("0"))
        rows["Inventories"][year] = delta(parsed.balance, "Inventory", year, comparison_year, reverse=True) if comparison_year is not None else -(get_value(parsed.balance, "Inventory", year) or Decimal("0"))
        rows["Prepaid and deposits"][year] = delta(parsed.balance, "Prepaid Expenses & Deposits", year, comparison_year, reverse=True) if comparison_year is not None else -(get_value(parsed.balance, "Prepaid Expenses & Deposits", year) or Decimal("0"))
        rows["Accounts payable and accrued liabilities"][year] = delta(parsed.balance, "Accounts Payable & Accrued Liabilities", year, comparison_year) if comparison_year is not None else (get_value(parsed.balance, "Accounts Payable & Accrued Liabilities", year) or Decimal("0"))
        current_tax_payable = get_value(parsed.balance, "Income taxes payable", year) or Decimal("0")
        prior_tax_payable = get_value(parsed.balance, "Income taxes payable", comparison_year) or Decimal("0") if comparison_year is not None else Decimal("0")
        rows["Income taxes payable"][year] = current_tax_payable - prior_tax_payable
        rows["Acquisition of property and equipment"][year] = delta(parsed.balance, "Property & Equipment", year, comparison_year, reverse=True) if comparison_year is not None else -(get_value(parsed.balance, "Property & Equipment", year) or Decimal("0"))
        rows["Advances to related corporations"][year] = delta(parsed.balance, "Due to related parties", year, comparison_year) if comparison_year is not None else (get_value(parsed.balance, "Due to related parties", year) or Decimal("0"))
        rows["Dividends paid"][year] = None
        rows["Advances of shareholder's loan"][year] = None
        rows["Cash - Beginning of year"][year] = (
            rows["Cash - End of year"].get(prior) if prior is not None else Decimal("0")
        )

        operating = sum(
            (rows[label].get(year) or Decimal("0"))
            for label in [
                "Net income",
                "Depreciation and amortization",
                "Accounts receivable",
                "Inventories",
                "Prepaid and deposits",
                "Accounts payable and accrued liabilities",
                "Income taxes payable",
            ]
        )
        investing = rows["Acquisition of property and equipment"].get(year)
        other_financing = sum(
            (rows[label].get(year) or Decimal("0"))
            for label in [
                "Advances to related corporations",
                "Dividends paid",
                "Advances of shareholder's loan",
            ]
        )
        target_ending_cash = get_value(parsed.balance, "Cash", year) if prior is not None else Decimal("0")
        if target_ending_cash is None:
            target_ending_cash = rows["Cash - Beginning of year"].get(year) or Decimal("0")
        target_cash_change = target_ending_cash - (rows["Cash - Beginning of year"].get(year) or Decimal("0"))
        rows["Proceeds from (repayment of) bank loan"][year] = target_cash_change - operating - (investing or Decimal("0")) - other_financing
        financing = rows["Proceeds from (repayment of) bank loan"][year] + other_financing
        rows["Cash provided by (used in) operating activities"][year] = operating
        rows["Cash used in investing activities"][year] = investing
        rows["Cash used for financing activities"][year] = financing
        increase = operating + (investing or Decimal("0")) + financing
        rows["Increase (decrease) in cash"][year] = increase
        rows["Cash - End of year"][year] = (rows["Cash - Beginning of year"].get(year) or Decimal("0")) + increase

    output = [
        header,
        ["", *["Full year" for _ in selected_years]],
        ["", *[currency_symbol(parsed.currency) for _ in selected_years]],
    ]
    for label in CASH_FLOW_ORDER:
        values = [rows[label].get(year) for year in selected_years]
        if any(value is not None and value != 0 for value in values) or label in {
            "Net income",
            "Income taxes payable",
            "Cash provided by (used in) operating activities",
            "Increase (decrease) in cash",
            "Cash - Beginning of year",
            "Cash - End of year",
        }:
            output.append([label, *[decimal_to_display(v) for v in values]])
    return output


def build_formula_table(selected_years: list[int]) -> list[list[str]]:
    latest = selected_years[0] if selected_years else "current year"
    prior = selected_years[1] if len(selected_years) > 1 else "prior year"
    current_prior = f"{latest} and {prior}" if selected_years else "current and prior years"

    return [
        ["Area", "Line item", "Formula used"],
        ["Input", "Source rows", "Amounts are extracted from the uploaded Income Statement and Balance Sheet"],
        ["Income Statement", "Gross Revenue", "Cost of Sales + Gross Margin when Gross Revenue is not provided"],
        ["Income Statement", "Cost of Sales", "Materials + Labour + Variable Costs + Fixed Costs when Cost of Sales is not provided"],
        ["Income Statement", "Gross Margin", "Gross Revenue - Cost of Sales"],
        ["Income Statement", "Operating Costs", "Logistics + SG&A + Depreciation + Interest when Operating Costs is not provided"],
        ["Income Statement", "Operating Income", "Gross Margin - Operating Costs"],
        ["Income Statement", "Net Income", "Operating Income - Corporate Tax when Net Income is not provided"],
        ["Income Statement", "EBITDA", "Net Income + Interest + Depreciation + Corporate Tax"],
        ["Balance Sheet", "Total Assets", "Cash + Accounts receivable + Inventory + Prepaids and deposits + Property and equipment + Due from related parties + Other assets when Total Assets is not provided"],
        ["Balance Sheet", "Total Liabilities", "Bank indebtedness + Accounts payable + Income taxes payable + Short-term loans + Due to related parties + CEBA loan + Long-term loans when Total Liabilities is not provided"],
        ["Balance Sheet", "Shareholder Equity", "Common Shares + Retained Earnings when Shareholder Equity is not provided"],
        ["Balance Sheet", "TL + SE", "Total Liabilities + Shareholder Equity"],
        ["Analysis", "Vertical analysis - Income Statement", "Line item / Gross Revenue for the same year"],
        ["Analysis", "Vertical analysis - Balance Sheet assets", "Asset line item / Total Assets for the same year"],
        ["Analysis", "Vertical analysis - Balance Sheet liabilities", "Liability line item / Total Liabilities for the same year"],
        ["Analysis", "Vertical analysis - Balance Sheet equity", "Equity line item / Shareholder Equity for the same year"],
        ["Analysis", f"Horizontal analysis {latest} vs {prior}", f"{latest} amount / {prior} amount - 1"],
        ["Cash Flow", "Net income", "Net Income from Income Statement"],
        ["Cash Flow", "Depreciation and amortization", "Depreciation from Income Statement"],
        ["Cash Flow", f"Accounts receivable for {current_prior}", "Prior year Accounts receivable - Current year Accounts receivable"],
        ["Cash Flow", f"Inventories for {current_prior}", "Prior year Inventory - Current year Inventory"],
        ["Cash Flow", f"Prepaid and deposits for {current_prior}", "Prior year Prepaids and deposits - Current year Prepaids and deposits"],
        ["Cash Flow", f"Accounts payable for {current_prior}", "Current year Accounts payable - Prior year Accounts payable"],
        ["Cash Flow", f"Income taxes payable for {current_prior}", "Current year Income taxes payable - Prior year Income taxes payable"],
        ["Cash Flow", "Cash provided by operating activities", "Net income + Depreciation + Working capital changes"],
        ["Cash Flow", f"Acquisition of property and equipment for {current_prior}", "Prior year Property and equipment - Current year Property and equipment"],
        ["Cash Flow", "Cash used in investing activities", "Acquisition of property and equipment"],
        ["Cash Flow", "Proceeds from repayment of bank loan", "Balancing financing line: Target cash change - Operating cash flow - Investing cash flow - Other financing activity"],
        ["Cash Flow", "Advances to related corporations", "Current year Due to related parties - Prior year Due to related parties"],
        ["Cash Flow", "Cash used for financing activities", "Bank loan activity + Related party activity + Dividends + Shareholder loan activity"],
        ["Cash Flow", "Increase decrease in cash", "Operating cash flow + Investing cash flow + Financing cash flow"],
        ["Cash Flow", "Cash - Beginning of year", "Prior year computed Cash - End of year; earliest year starts at zero"],
        ["Cash Flow", "Cash - End of year", "Cash - Beginning of year + Increase decrease in cash"],
    ]


def build_content(parsed: ParsedFinancials) -> str:
    years = years_for(parsed)
    selected_years = years[:2]
    sections: list[str] = []

    overview = [
        ["Account", "Value"],
        ["Company name", parsed.company_name],
        ["Reporting Currency", parsed.currency],
        ["Reporting Unit", parsed.unit],
    ]
    sections.append("### Company Overview\n" + table_to_csv(overview))

    if not selected_years:
        sections.append(
            "I cannot parse reliable financial statement years and amounts from the extracted text. No values were invented."
        )
        return "\n\n".join(sections)

    income_table = build_statement_table(parsed.income, INCOME_ORDER, selected_years, "Gross Revenue", parsed.currency)
    if len(income_table) > 1:
        sections.append("### Income Statement\n" + table_to_csv(income_table))
    else:
        parsed.warnings.append("Income Statement was not parsed from the extracted text.")

    balance_table = build_statement_table(parsed.balance, BALANCE_ORDER, selected_years, "__balance_sheet__", parsed.currency)
    if len(balance_table) > 1:
        sections.append("### Balance Sheet\n" + table_to_csv(balance_table))
    else:
        parsed.warnings.append("Balance Sheet was not parsed from the extracted text.")

    if len(income_table) > 1 and len(balance_table) > 1:
        sections.append("### Cash Flow Statement (Computed from Balance Sheet and Income Statement)\n" + table_to_csv(build_cash_flow(parsed, selected_years)))
    else:
        parsed.warnings.append("Cash Flow Statement cannot be computed because a parsed Income Statement and Balance Sheet are both required.")

    if "EBITDA" in parsed.income:
        ebitda_rows = [
            ["Account", *[str(y) for y in selected_years]],
            ["", *["Full year" for _ in selected_years]],
            ["", *[currency_symbol(parsed.currency) for _ in selected_years]],
            ["EBITDA", *[decimal_to_display(get_value(parsed.income, "EBITDA", y)) for y in selected_years]],
        ]
        sections.append("### EBITDA\n" + table_to_csv(ebitda_rows))

    sections.append("### Calculation Formulas\n" + table_to_csv(build_formula_table(selected_years)))

    if parsed.warnings:
        warning_rows = [["Warning"], *[[warning] for warning in parsed.warnings]]
        sections.append("### Warnings\n" + table_to_csv(warning_rows))

    return "\n\n\n\n".join(sections)


def main() -> int:
    payload = json.load(sys.stdin)
    text = payload.get("fileText") or ""
    file_name = payload.get("fileName") or ""
    parsed = parse_financials(text, file_name)
    content = build_content(parsed)
    print(json.dumps({"content": content}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
