#!/usr/bin/env python3
"""
generate_mock_data.py — Odysseus Mock Financial Data Generator

Generates deterministic synthetic financial data for the Odysseus personal
finance AI prototype. Produces three JSON files:

  - data/user-profile.json  (user persona)
  - data/transactions.json  (raw bank feed — no AI labels)
  - data/ground-truth.json  (answer key for AI evaluation)

Usage:
    python generate_mock_data.py

Deterministic: random.seed(42). Same output every run.
No external dependencies beyond Python standard library.
"""

import json
import random
import calendar
from datetime import date, timedelta
from collections import defaultdict

# ============================================================
# Deterministic seed
# ============================================================
random.seed(42)

# ============================================================
# Date range — 24 months
# ============================================================
START_DATE = date(2024, 1, 1)
END_DATE = date(2025, 12, 31)

# ============================================================
# User Profile (exact specification from prompt)
# ============================================================
USER_PROFILE = {
    "id": "user_001",
    "name": "Marcus Chen",
    "age": 27,
    "province": "Ontario",
    "city": "Toronto",
    "income": {
        "gross_annual": 72000,
        "net_biweekly": 2076,
        "pay_schedule": "biweekly",
        "pay_day": "friday",
        "employer": "Shopify",
    },
    "accounts": {
        "chequing_balance": 3200,
        "savings_balance": 8500,
        "tfsa_balance": 4200,
        "rrsp_balance": 0,
    },
    "risk_tolerance": "medium",
    "investment_horizon": "long",
    "goals": [
        "build emergency fund to 15k",
        "start investing consistently",
        "quit vaping",
    ],
    "created_at": "2024-01-01",
}


# ============================================================
# Helpers: ID generation
# ============================================================
_txn_counter = 0


def next_txn_id():
    """Return the next sequential transaction ID."""
    global _txn_counter
    _txn_counter += 1
    return f"txn_{_txn_counter:06d}"


def reset_txn_counter():
    """Reset the transaction ID counter to zero."""
    global _txn_counter
    _txn_counter = 0


# ============================================================
# Helpers: dates
# ============================================================
def get_biweekly_fridays(start, end, first_payday):
    """Generate biweekly payday dates from first_payday within [start, end]."""
    paydays = []
    current = first_payday
    while current <= end:
        if current >= start:
            paydays.append(current)
        current += timedelta(days=14)
    return paydays


def day_in_month(year, month, target_day):
    """Return a date clamped to the actual month length."""
    max_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(target_day, max_day))


def iter_months(start, end):
    """Yield (year, month) tuples for each month in range."""
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        yield y, m
        m += 1
        if m > 12:
            m = 1
            y += 1


def iter_weeks(start, end):
    """Yield Monday-start dates for each ISO week overlapping the range."""
    # Align to first Monday on or after start
    current = start
    while current.weekday() != 0:
        current += timedelta(days=1)
    while current <= end:
        yield current
        current += timedelta(days=7)


def is_weekend(d):
    return d.weekday() >= 5


def round_amount(val):
    """Round to 2 decimal places for currency."""
    return round(val, 2)


# ============================================================
# Helpers: transaction construction
# ============================================================
def make_txn(d, amount, merchant, category, description, txn_type=None):
    """Build a single transaction dict (no classification fields)."""
    if txn_type is None:
        txn_type = "credit" if amount > 0 else "debit"
    return {
        "id": next_txn_id(),
        "date": d.isoformat(),
        "amount": round_amount(amount),
        "merchant": merchant,
        "category": category,
        "type": txn_type,
        "description": description,
    }


def pick_weighted(options):
    """Pick from a list of (value, weight) tuples."""
    values, weights = zip(*options)
    return random.choices(values, weights=weights, k=1)[0]


# ============================================================
# Spending model: Fixed recurring (monthly)
# ============================================================
FIXED_RECURRING = [
    {
        "merchant": "Toronto Property Mgmt",
        "category": "rent",
        "amount": -1650.00,
        "day": 1,
        "desc": "Rent - 88 Harbour St Unit 2104",
        "variance": False,
    },
    {
        "merchant": "Rogers",
        "category": "phone",
        "amount": -65.00,
        "day": 18,
        "desc": "Rogers Wireless - Monthly",
        "variance": True,
    },
    {
        "merchant": "Bell",
        "category": "internet",
        "amount": -74.99,
        "day": 22,
        "desc": "Bell Fibe Internet 500",
        "variance": True,
    },
    {
        "merchant": "GoodLife Fitness",
        "category": "gym",
        "amount": -54.99,
        "day": 1,
        "desc": "GoodLife Fitness - Monthly",
        "variance": False,
    },
    {
        "merchant": "Netflix",
        "category": "subscriptions",
        "amount": -16.49,
        "day": 8,
        "desc": "Netflix Premium",
        "variance": False,
    },
    {
        "merchant": "Spotify",
        "category": "subscriptions",
        "amount": -11.99,
        "day": 12,
        "desc": "Spotify Premium",
        "variance": False,
    },
    {
        "merchant": "Apple",
        "category": "subscriptions",
        "amount": -3.99,
        "day": 5,
        "desc": "Apple - iCloud+ 200GB",
        "variance": False,
    },
    {
        "merchant": "Presto",
        "category": "transit",
        "amount": -156.00,
        "day": 1,
        "desc": "Presto - TTC Monthly Pass",
        "variance": False,
    },
    {
        "merchant": "Sun Life",
        "category": "insurance",
        "amount": -45.00,
        "day": 15,
        "desc": "Sun Life - Tenant Insurance",
        "variance": False,
    },
]


# ============================================================
# Spending model: Habit-linked patterns
#
# These are the patterns Odysseus must detect.
# Each has merchant options, frequency, amount range, and
# descriptions that look like raw bank feed entries.
# ============================================================
HABITS = {
    "coffee": {
        "merchants": [
            ("Tim Hortons", 0.50),
            ("Starbucks", 0.35),
            ("Second Cup", 0.10),
            ("Aroma Espresso Bar", 0.05),
        ],
        "category": "coffee",
        "freq_per_week": (3, 6),
        "amount_range": (3.25, 7.80),
        "descs": {
            "Tim Hortons": [
                "Tim Hortons",
                "Tim Hortons - Medium Double Double",
                "Tim Hortons - Iced Capp",
                "Tim Hortons - Breakfast Combo",
            ],
            "Starbucks": [
                "Starbucks",
                "Starbucks - Grande Latte",
                "Starbucks - Cold Brew",
                "Starbucks - Matcha Latte",
            ],
            "Second Cup": ["Second Cup", "Second Cup - Americano"],
            "Aroma Espresso Bar": ["Aroma Espresso Bar", "Aroma - Cappuccino"],
        },
        "weekday_bias": 0.75,
    },
    "food_delivery": {
        "merchants": [
            ("UberEats", 0.45),
            ("DoorDash", 0.35),
            ("SkipTheDishes", 0.20),
        ],
        "category": "food_delivery",
        "freq_per_week": (1.5, 3.5),
        "amount_range": (16.00, 48.00),
        "descs": {
            "UberEats": [
                "UberEats - Order #{}",
                "UberEats",
                "UberEats - Delivery",
            ],
            "DoorDash": [
                "DoorDash - Order #{}",
                "DoorDash",
                "DoorDash - Delivery",
            ],
            "SkipTheDishes": [
                "SkipTheDishes - Order #{}",
                "SkipTheDishes",
            ],
        },
        "weekend_bias": 0.55,
        "uses_order_numbers": True,
    },
    "vaping": {
        "merchants": [
            ("180 Smoke", 0.45),
            ("VapeKing", 0.30),
            ("Smoke Outlet", 0.25),
        ],
        "category": "vaping",
        "freq_per_week": (1.0, 2.5),
        "amount_range": (14.00, 38.00),
        "descs": {
            "180 Smoke": ["180 Smoke - Vape Supplies", "180 Smoke"],
            "VapeKing": ["VapeKing", "VapeKing - E-Liquid"],
            "Smoke Outlet": ["Smoke Outlet", "Smoke Outlet - Vape"],
        },
    },
    "alcohol": {
        "merchants": [
            ("LCBO", 0.40),
            ("Beer Store", 0.20),
            ("Bar Hop", 0.15),
            ("The Pint", 0.15),
            ("Bandit Brewery", 0.10),
        ],
        "category": "alcohol",
        "freq_per_week": (0.5, 2.0),
        "amount_range": (12.00, 52.00),
        "descs": {
            "LCBO": ["LCBO", "LCBO - Queen & Bay"],
            "Beer Store": ["Beer Store", "The Beer Store"],
            "Bar Hop": ["Bar Hop - Tab", "Bar Hop"],
            "The Pint": ["The Pint - Tab", "The Pint"],
            "Bandit Brewery": ["Bandit Brewery - Tab", "Bandit Brewery"],
        },
        "weekend_bias": 0.65,
    },
}

# Impulse shopping is monthly-frequency, not weekly
HABIT_IMPULSE = {
    "merchants": [
        ("Amazon", 0.50),
        ("Best Buy", 0.20),
        ("Winners", 0.15),
        ("Uniqlo", 0.15),
    ],
    "category": "impulse_shopping",
    "freq_per_month": (2, 5),
    "amount_range": (12.00, 95.00),
    "descs": {
        "Amazon": [
            "Amazon.ca - Order #{}",
            "Amazon.ca",
            "Amazon.ca - Marketplace",
        ],
        "Best Buy": ["Best Buy", "Best Buy Canada"],
        "Winners": ["Winners - Queen St", "Winners"],
        "Uniqlo": ["Uniqlo - Eaton Centre", "Uniqlo"],
    },
    "uses_order_numbers": True,
}


# ============================================================
# Spending model: Variable essentials
# ============================================================
VARIABLE = {
    "groceries": {
        "merchants": [
            ("No Frills", 0.35),
            ("Loblaws", 0.25),
            ("FreshCo", 0.15),
            ("Metro", 0.15),
            ("T&T Supermarket", 0.10),
        ],
        "category": "groceries",
        "freq_per_week": (2, 3),
        "amount_range": (22.00, 85.00),
        "descs": {
            "No Frills": ["No Frills", "No Frills - Groceries"],
            "Loblaws": ["Loblaws", "Loblaws - Groceries"],
            "FreshCo": ["FreshCo", "FreshCo - Groceries"],
            "Metro": ["Metro", "Metro - Groceries"],
            "T&T Supermarket": ["T&T Supermarket", "T&T - Groceries"],
        },
    },
    "dining_out": {
        "merchants": [
            ("McDonald's", 0.20),
            ("Popeyes", 0.15),
            ("Chipotle", 0.15),
            ("Osmow's", 0.15),
            ("Subway", 0.10),
            ("Pizza Pizza", 0.10),
            ("Banh Mi Boys", 0.10),
            ("Pai Northern Thai", 0.05),
        ],
        "category": "dining_out",
        "freq_per_week": (1, 3),
        "amount_range": (8.50, 36.00),
        "descs": {
            "McDonald's": ["McDonald's", "McDonald's - Mobile Order"],
            "Popeyes": ["Popeyes", "Popeyes Louisiana Kitchen"],
            "Chipotle": ["Chipotle", "Chipotle - Burrito Bowl"],
            "Osmow's": ["Osmow's Shawarma", "Osmow's"],
            "Subway": ["Subway", "Subway - Online Order"],
            "Pizza Pizza": ["Pizza Pizza", "Pizza Pizza - Delivery"],
            "Banh Mi Boys": ["Banh Mi Boys", "Banh Mi Boys - Order"],
            "Pai Northern Thai": ["Pai Northern Thai", "Pai - Dinner"],
        },
    },
    "rideshare": {
        "merchants": [
            ("Uber", 0.65),
            ("Lyft", 0.35),
        ],
        "category": "rideshare",
        "freq_per_week": (0, 2),
        "amount_range": (8.50, 32.00),
        "descs": {
            "Uber": ["Uber - Trip", "Uber"],
            "Lyft": ["Lyft - Ride", "Lyft"],
        },
        "weekend_bias": 0.50,
    },
}


# ============================================================
# Spending model: One-off / seasonal items
# ============================================================
ONE_OFF_TYPES = [
    {
        "merchant": "Dr. Wong Dental",
        "category": "health",
        "amount_range": (-185, -85),
        "desc": "Dr. Wong Dental - Cleaning",
        "avg_months_between": 6,
    },
    {
        "merchant": "Crowns Barbershop",
        "category": "personal_care",
        "amount_range": (-48, -30),
        "desc": "Crowns Barbershop",
        "avg_months_between": 2,
    },
    {
        "merchant": "Shoppers Drug Mart",
        "category": "pharmacy",
        "amount_range": (-38, -6),
        "desc": "Shoppers Drug Mart",
        "avg_months_between": 2,
    },
    {
        "merchant": "Rexall",
        "category": "pharmacy",
        "amount_range": (-25, -8),
        "desc": "Rexall Pharmacy",
        "avg_months_between": 3,
    },
]


# ============================================================
# Generator: Income
# ============================================================
def generate_income():
    """Biweekly payroll deposits from Shopify."""
    # First payday in 2024: Friday, January 5
    first_payday = date(2024, 1, 5)
    paydays = get_biweekly_fridays(START_DATE, END_DATE, first_payday)

    txns = []
    for payday in paydays:
        txns.append(
            make_txn(
                d=payday,
                amount=2076.00,
                merchant="Shopify",
                category="income",
                description="Shopify Inc. - Payroll Direct Deposit",
                txn_type="credit",
            )
        )
    return txns


# ============================================================
# Generator: Fixed recurring
# ============================================================
def generate_fixed_recurring():
    """Monthly fixed-amount bills and subscriptions."""
    txns = []
    for year, month in iter_months(START_DATE, END_DATE):
        for item in FIXED_RECURRING:
            txn_date = day_in_month(year, month, item["day"])
            if txn_date < START_DATE or txn_date > END_DATE:
                continue

            amount = item["amount"]
            # Small variance for usage-based bills (phone, internet)
            if item["variance"]:
                amount = round_amount(amount + random.uniform(-3, 6))

            txns.append(
                make_txn(
                    d=txn_date,
                    amount=amount,
                    merchant=item["merchant"],
                    category=item["category"],
                    description=item["desc"],
                )
            )
    return txns


# ============================================================
# Generator: Habit-linked (weekly frequency)
# ============================================================
def _seasonal_multiplier(month):
    """
    Seasonal spending modifier.
    December = holiday spike. Summer = social spike. January = resolution dip.
    """
    modifiers = {
        1: 0.85,   # New Year's resolutions
        2: 0.95,
        3: 1.00,
        4: 1.00,
        5: 1.05,
        6: 1.10,   # Summer ramp-up
        7: 1.15,   # Peak summer social
        8: 1.10,
        9: 1.00,
        10: 1.00,
        11: 1.10,  # Pre-holiday
        12: 1.30,  # Holiday spike
    }
    return modifiers.get(month, 1.0)


def _pick_day_in_week(week_start, end, bias=None):
    """
    Pick a random day within the week, optionally biased toward
    weekdays or weekends.
    """
    if bias == "weekday":
        # 75% chance weekday, 25% weekend
        if random.random() < 0.75:
            offset = random.randint(0, 4)  # Mon–Fri
        else:
            offset = random.choice([5, 6])
    elif bias == "weekend":
        if random.random() < 0.55:
            offset = random.choice([5, 6])
        else:
            offset = random.randint(0, 4)
    else:
        offset = random.randint(0, 6)

    d = week_start + timedelta(days=offset)
    if d < START_DATE or d > end:
        return None
    return d


# Shared order number counters across all habit generators
_order_counters = {}


def _resolve_description(merchant, descs_map):
    """Pick a description, filling in order numbers if needed."""
    global _order_counters
    desc = random.choice(descs_map[merchant])
    if "{}" in desc:
        _order_counters[merchant] = _order_counters.get(merchant, 8000) + random.randint(1, 7)
        desc = desc.format(_order_counters[merchant])
    return desc


def generate_habit_weekly_txns(habit_key, habit_cfg):
    """Generate all transactions for a single weekly-frequency habit."""
    txns = []
    low_f, high_f = habit_cfg["freq_per_week"]
    low_a, high_a = habit_cfg["amount_range"]

    # Determine day-bias type
    bias = None
    if "weekday_bias" in habit_cfg:
        bias = "weekday"
    elif "weekend_bias" in habit_cfg:
        bias = "weekend"

    for week_start in iter_weeks(START_DATE, END_DATE):
        month = week_start.month
        seasonal = _seasonal_multiplier(month)

        # Frequency for this week (with seasonal scaling + noise)
        freq = max(0, round(random.uniform(low_f * seasonal, high_f * seasonal)))

        for _ in range(freq):
            d = _pick_day_in_week(week_start, END_DATE, bias=bias)
            if d is None:
                continue

            merchant = pick_weighted(habit_cfg["merchants"])
            amount = -round_amount(random.uniform(low_a, high_a))
            desc = _resolve_description(merchant, habit_cfg["descs"])

            txns.append(
                make_txn(
                    d=d,
                    amount=amount,
                    merchant=merchant,
                    category=habit_cfg["category"],
                    description=desc,
                )
            )
    return txns


def generate_habit_monthly_txns(habit_cfg):
    """Generate transactions for a monthly-frequency habit (impulse shopping)."""
    txns = []
    low_f, high_f = habit_cfg["freq_per_month"]
    low_a, high_a = habit_cfg["amount_range"]

    for year, month in iter_months(START_DATE, END_DATE):
        seasonal = _seasonal_multiplier(month)

        # Holiday season: more impulse buys
        bonus = 0
        if month in (11, 12):
            bonus = random.randint(1, 3)

        freq = max(0, round(random.uniform(low_f * seasonal, high_f * seasonal))) + bonus
        max_day = calendar.monthrange(year, month)[1]

        for _ in range(freq):
            day = random.randint(1, max_day)
            d = date(year, month, day)
            if d < START_DATE or d > END_DATE:
                continue

            merchant = pick_weighted(habit_cfg["merchants"])
            amount = -round_amount(random.uniform(low_a, high_a))
            desc = _resolve_description(merchant, habit_cfg["descs"])

            txns.append(
                make_txn(
                    d=d,
                    amount=amount,
                    merchant=merchant,
                    category=habit_cfg["category"],
                    description=desc,
                )
            )
    return txns


def generate_all_habits():
    """Generate all habit-linked transactions."""
    txns = []

    # Weekly-frequency habits
    for key, cfg in HABITS.items():
        txns.extend(generate_habit_weekly_txns(key, cfg))

    # Monthly-frequency habit (impulse shopping)
    txns.extend(generate_habit_monthly_txns(HABIT_IMPULSE))

    return txns


# ============================================================
# Generator: Variable essentials (groceries, dining, rideshare)
# ============================================================
def generate_variable_spending():
    """Generate essential variable spending (groceries, dining, rideshare)."""
    txns = []

    for key, cfg in VARIABLE.items():
        low_f, high_f = cfg["freq_per_week"]
        low_a, high_a = cfg["amount_range"]

        bias = None
        if "weekend_bias" in cfg:
            bias = "weekend"

        for week_start in iter_weeks(START_DATE, END_DATE):
            freq = max(0, round(random.uniform(low_f, high_f)))

            for _ in range(freq):
                d = _pick_day_in_week(week_start, END_DATE, bias=bias)
                if d is None:
                    continue

                merchant = pick_weighted(cfg["merchants"])
                amount = -round_amount(random.uniform(low_a, high_a))
                desc = random.choice(cfg["descs"][merchant])

                txns.append(
                    make_txn(
                        d=d,
                        amount=amount,
                        merchant=merchant,
                        category=cfg["category"],
                        description=desc,
                    )
                )
    return txns


# ============================================================
# Generator: One-off / seasonal / irregular
# ============================================================
def generate_one_offs():
    """Irregular spending: dentist, haircuts, pharmacy, holidays, gifts, e-transfers."""
    txns = []

    # --- Recurring one-offs (probabilistic per month) ---
    for year, month in iter_months(START_DATE, END_DATE):
        for item in ONE_OFF_TYPES:
            prob = 1.0 / item["avg_months_between"]
            if random.random() < prob:
                max_day = calendar.monthrange(year, month)[1]
                d = date(year, month, random.randint(1, max_day))
                if d < START_DATE or d > END_DATE:
                    continue
                low, high = item["amount_range"]
                amount = round_amount(random.uniform(low, high))
                txns.append(
                    make_txn(
                        d=d,
                        amount=amount,
                        merchant=item["merchant"],
                        category=item["category"],
                        description=item["desc"],
                    )
                )

    # --- Seasonal: Black Friday ---
    for year in (2024, 2025):
        bf = date(year, 11, random.randint(25, 29))
        if START_DATE <= bf <= END_DATE:
            txns.append(
                make_txn(
                    d=bf,
                    amount=-round_amount(random.uniform(120, 380)),
                    merchant="Best Buy",
                    category="electronics",
                    description="Best Buy - Black Friday Sale",
                )
            )

    # --- Seasonal: Holiday gifts (December) ---
    for year in (2024, 2025):
        for _ in range(random.randint(3, 6)):
            d = date(year, 12, random.randint(8, 24))
            if d < START_DATE or d > END_DATE:
                continue
            merchant = random.choice(["Amazon.ca", "Indigo", "Winners", "Apple Store"])
            txns.append(
                make_txn(
                    d=d,
                    amount=-round_amount(random.uniform(25, 120)),
                    merchant=merchant,
                    category="gifts",
                    description=f"{merchant} - Holiday Gift",
                )
            )

    # --- Occasional e-Transfers received (birthday money, friend repayment) ---
    for year in (2024, 2025):
        for _ in range(random.randint(3, 6)):
            month = random.randint(1, 12)
            max_day = calendar.monthrange(year, month)[1]
            d = date(year, month, random.randint(1, max_day))
            if d < START_DATE or d > END_DATE:
                continue
            amount = round_amount(random.uniform(20, 200))
            txns.append(
                make_txn(
                    d=d,
                    amount=amount,
                    merchant="Interac",
                    category="transfer",
                    description="Interac e-Transfer Received",
                    txn_type="credit",
                )
            )

    # --- Occasional large one-off expenses ---
    large_expenses = [
        (date(2024, 3, 15), -285.00, "Apple Store", "electronics", "Apple Store - AirPods Pro"),
        (date(2024, 6, 22), -149.99, "Decathlon", "fitness", "Decathlon - Running Shoes"),
        (date(2024, 9, 8), -320.00, "WestJet", "travel", "WestJet - YYZ to YVR"),
        (date(2024, 10, 5), -89.99, "IKEA", "home", "IKEA - Shelf Unit"),
        (date(2025, 2, 14), -95.00, "Alo Restaurant", "dining_out", "Alo Restaurant - Valentine's"),
        (date(2025, 4, 20), -199.99, "Apple Store", "electronics", "Apple Store - MagSafe Charger Kit"),
        (date(2025, 7, 1), -175.00, "Airbnb", "travel", "Airbnb - Canada Day Weekend"),
        (date(2025, 8, 15), -250.00, "Porter Airlines", "travel", "Porter Airlines - YTZ to YOW"),
        (date(2025, 11, 3), -129.99, "Decathlon", "fitness", "Decathlon - Winter Jacket"),
    ]
    for d, amount, merchant, category, desc in large_expenses:
        if START_DATE <= d <= END_DATE:
            txns.append(make_txn(d=d, amount=amount, merchant=merchant, category=category, description=desc))

    return txns


# ============================================================
# Ground truth computation
# ============================================================
def compute_ground_truth(transactions):
    """
    Build the answer key from actual generated data.

    This file is NOT loaded by the app. It evaluates whether the AI
    correctly identified patterns, recurring merchants, and habits.
    """

    # --- Recurring merchants ---
    recurring_merchants = []
    for item in FIXED_RECURRING:
        recurring_merchants.append(
            {
                "merchant": item["merchant"],
                "category": item["category"],
                "expected_amount": item["amount"],
                "expected_day": item["day"],
                "frequency": "monthly",
            }
        )
    # Payroll
    recurring_merchants.append(
        {
            "merchant": "Shopify",
            "category": "income",
            "expected_amount": 2076.00,
            "expected_day": "biweekly_friday",
            "frequency": "biweekly",
        }
    )

    # --- Habit patterns ---
    # First, compute actual monthly costs per category from the data
    monthly_totals = defaultdict(lambda: defaultdict(float))
    monthly_counts = defaultdict(lambda: defaultdict(int))
    for txn in transactions:
        if txn["amount"] < 0:
            ym = txn["date"][:7]
            cat = txn["category"]
            monthly_totals[cat][ym] += abs(txn["amount"])
            monthly_counts[cat][ym] += 1

    def avg_monthly(category):
        if category not in monthly_totals:
            return 0.0
        vals = list(monthly_totals[category].values())
        return round(sum(vals) / len(vals), 2) if vals else 0.0

    def avg_monthly_count(category):
        if category not in monthly_counts:
            return 0.0
        vals = list(monthly_counts[category].values())
        return round(sum(vals) / len(vals), 1) if vals else 0.0

    habit_patterns = [
        {
            "pattern_name": "daily_coffee",
            "category": "coffee",
            "merchants": [m for m, _ in HABITS["coffee"]["merchants"]],
            "avg_monthly_frequency": avg_monthly_count("coffee"),
            "avg_monthly_cost": avg_monthly("coffee"),
            "detectable": True,
            "recommendation": (
                "Reduce coffee purchases by making coffee at home 3x/week. "
                "Potential monthly savings: ~$45-65."
            ),
        },
        {
            "pattern_name": "food_delivery_habit",
            "category": "food_delivery",
            "merchants": [m for m, _ in HABITS["food_delivery"]["merchants"]],
            "avg_monthly_frequency": avg_monthly_count("food_delivery"),
            "avg_monthly_cost": avg_monthly("food_delivery"),
            "detectable": True,
            "recommendation": (
                "Replace 2 delivery orders per week with home cooking. "
                "Potential monthly savings: ~$140-200."
            ),
        },
        {
            "pattern_name": "vaping_habit",
            "category": "vaping",
            "merchants": [m for m, _ in HABITS["vaping"]["merchants"]],
            "avg_monthly_frequency": avg_monthly_count("vaping"),
            "avg_monthly_cost": avg_monthly("vaping"),
            "detectable": True,
            "recommendation": (
                "Quit vaping entirely (aligns with stated goal). "
                "Potential monthly savings: ~$130-180."
            ),
        },
        {
            "pattern_name": "social_drinking",
            "category": "alcohol",
            "merchants": [m for m, _ in HABITS["alcohol"]["merchants"]],
            "avg_monthly_frequency": avg_monthly_count("alcohol"),
            "avg_monthly_cost": avg_monthly("alcohol"),
            "detectable": True,
            "recommendation": (
                "Reduce bar visits to 2x/month, buy at LCBO instead. "
                "Potential monthly savings: ~$80-120."
            ),
        },
        {
            "pattern_name": "impulse_online_shopping",
            "category": "impulse_shopping",
            "merchants": [m for m, _ in HABIT_IMPULSE["merchants"]],
            "avg_monthly_frequency": avg_monthly_count("impulse_shopping"),
            "avg_monthly_cost": avg_monthly("impulse_shopping"),
            "detectable": True,
            "recommendation": (
                "Implement a 48-hour rule before any online purchase. "
                "Potential monthly savings: ~$50-100."
            ),
        },
    ]

    # --- Income streams ---
    income_streams = [
        {
            "source": "Shopify",
            "type": "employment",
            "frequency": "biweekly",
            "expected_amount": 2076.00,
        }
    ]

    # --- Monthly summary (computed from actual data) ---
    monthly_summary = {}
    for year, month in iter_months(START_DATE, END_DATE):
        ym = f"{year}-{month:02d}"
        month_txns = [t for t in transactions if t["date"].startswith(ym)]

        income = sum(t["amount"] for t in month_txns if t["amount"] > 0)
        spending = sum(abs(t["amount"]) for t in month_txns if t["amount"] < 0)
        surplus = round(income - spending, 2)

        cat_breakdown = defaultdict(float)
        for t in month_txns:
            if t["amount"] < 0:
                cat_breakdown[t["category"]] += abs(t["amount"])

        monthly_summary[ym] = {
            "income": round(income, 2),
            "spending": round(spending, 2),
            "surplus": surplus,
            "transaction_count": len(month_txns),
            "category_breakdown": {
                k: round(v, 2) for k, v in sorted(cat_breakdown.items())
            },
        }

    return {
        "recurring_merchants": recurring_merchants,
        "habit_patterns": habit_patterns,
        "income_streams": income_streams,
        "monthly_summary": monthly_summary,
    }


# ============================================================
# Summary report
# ============================================================
def print_summary(transactions, ground_truth):
    """Print a human-readable summary of generated data."""

    total = len(transactions)
    dates = [t["date"] for t in transactions]
    date_range = f"{min(dates)} to {max(dates)}"

    total_income = sum(t["amount"] for t in transactions if t["amount"] > 0)
    total_spending = sum(abs(t["amount"]) for t in transactions if t["amount"] < 0)

    summaries = ground_truth["monthly_summary"]
    num_months = len(summaries)
    avg_surplus = sum(m["surplus"] for m in summaries.values()) / num_months

    # Category monthly averages
    cat_totals = defaultdict(list)
    for data in summaries.values():
        for cat, val in data["category_breakdown"].items():
            cat_totals[cat].append(val)

    print()
    print("=" * 62)
    print("  ODYSSEUS -- Mock Data Generation Report")
    print("=" * 62)
    print(f"  Total transactions:    {total:,}")
    print(f"  Date range:            {date_range}")
    print(f"  Total income:          ${total_income:>12,.2f}")
    print(f"  Total spending:        ${total_spending:>12,.2f}")
    print(f"  Net:                   ${total_income - total_spending:>12,.2f}")
    print(f"  Months covered:        {num_months}")
    print(f"  Avg monthly surplus:   ${avg_surplus:>12,.2f}")
    print()
    print("  Category-Level Monthly Averages (across all 24 months):")
    print("  " + "-" * 44)

    sorted_cats = sorted(
        cat_totals.items(),
        key=lambda x: sum(x[1]) / num_months,
        reverse=True,
    )
    for cat, vals in sorted_cats:
        avg = sum(vals) / num_months  # Divide by ALL months, not just active ones
        print(f"    {cat:<28} ${avg:>9,.2f}")

    # Habit totals (averaged over all 24 months)
    habit_cats = {"coffee", "food_delivery", "vaping", "alcohol", "impulse_shopping"}
    habit_monthly_avg = 0
    for cat, vals in cat_totals.items():
        if cat in habit_cats:
            habit_monthly_avg += sum(vals) / num_months

    print()
    print(f"  Total habit spending (avg/mo): ${habit_monthly_avg:>9,.2f}")
    print(f"  Potential redirect to invest:  ${habit_monthly_avg * 0.45:>9,.2f}  (45% reduction)")
    print("=" * 62)
    print()


# ============================================================
# Main
# ============================================================
def main():
    reset_txn_counter()

    # Generate all transaction batches
    income_txns = generate_income()
    fixed_txns = generate_fixed_recurring()
    habit_txns = generate_all_habits()
    variable_txns = generate_variable_spending()
    oneoff_txns = generate_one_offs()

    # Merge all batches
    all_txns = income_txns + fixed_txns + habit_txns + variable_txns + oneoff_txns

    # Sort chronologically by date
    all_txns.sort(key=lambda t: t["date"])

    # Re-assign sequential IDs after sorting
    reset_txn_counter()
    for txn in all_txns:
        txn["id"] = next_txn_id()

    # Compute ground truth from actual data
    ground_truth = compute_ground_truth(all_txns)

    # Write output files
    with open("data/user-profile.json", "w") as f:
        json.dump(USER_PROFILE, f, indent=2)

    with open("data/transactions.json", "w") as f:
        json.dump(all_txns, f, indent=2)

    with open("data/ground-truth.json", "w") as f:
        json.dump(ground_truth, f, indent=2)

    print(f"  Generated files:")
    print(f"    data/user-profile.json")
    print(f"    data/transactions.json  ({len(all_txns):,} transactions)")
    print(f"    data/ground-truth.json")

    # Print summary report
    print_summary(all_txns, ground_truth)


if __name__ == "__main__":
    main()
