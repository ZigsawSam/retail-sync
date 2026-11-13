# Phase 2 — Central Accounting Ledger

## Objective

Make an immutable, owner-scoped double-entry journal the source of truth for cash, bank, receivables, payables, inventory and equity. Existing operational tables remain the invoice and workflow records; they are not themselves the general ledger.

## Guardrails

- No production migration or deployment from this branch until the production schema has been inspected and the migration has been reviewed against it.
- Preserve all historical sales, purchases, expenses and account_payments. Do not silently rewrite or delete historical transactions.
- Do not infer opening balances from today's transaction totals. Opening balances require an explicit as-of date and owner-confirmed values, with an opening-equity offset.
- Every posted journal entry must balance: total debits = total credits, in one currency.
- Posted journal entries and lines are immutable. Corrections use linked reversal entries and replacement entries.
- Enforce tenant ownership in database functions and RLS; do not trust client-supplied owner IDs.
- Posting source references must be unique per owner and source event to prevent duplicate ledger postings.
- Keep the existing Phase 1 transaction RPCs atomic. Ledger posting must be inside the same database transaction as the originating sale/purchase/payment/expense write.

## Proposed chart of accounts

| Code | Account | Type | Normal balance |
|---|---|---|---|
| 1000 | Cash on hand | Asset | Debit |
| 1010 | Bank | Asset | Debit |
| 1100 | Accounts receivable | Asset | Debit |
| 1200 | Inventory | Asset | Debit |
| 1500 | Fixed assets | Asset | Debit |
| 1590 | Accumulated depreciation | Contra-asset | Credit |
| 2000 | Accounts payable | Liability | Credit |
| 2100 | Other liabilities | Liability | Credit |
| 3000 | Owner capital | Equity | Credit |
| 3100 | Owner drawings | Contra-equity | Debit |
| 4000 | Sales revenue | Income | Credit |
| 4050 | Sales returns and allowances | Contra-income | Debit |
| 5000 | Cost of goods sold | Expense | Debit |
| 6000 | Operating expenses | Expense | Debit |
| 6100 | Bank/payment fees | Expense | Debit |

Accounts are tenant-specific. Additional accounts and subaccounts can be introduced without changing the journal contract.

## Posting rules

| Business event | Debit | Credit |
|---|---|---|
| Cash sale | Cash (amount received); COGS (cost) | Sales revenue (net of tax treatment); Inventory (cost); tax payable where applicable |
| Credit sale | Accounts receivable; COGS | Sales revenue; Inventory; tax payable where applicable |
| Collection | Cash or Bank | Accounts receivable |
| Cash purchase of inventory | Inventory | Cash or Bank |
| Credit purchase of inventory | Inventory | Accounts payable |
| Supplier payment | Accounts payable | Cash or Bank |
| Operating expense | Relevant expense | Cash or Bank or payable |
| Owner capital introduced | Cash or Bank | Owner capital |
| Owner withdrawal | Owner drawings | Cash or Bank |
| Bank transfer | Bank destination | Cash or Bank source |

Tax handling, discounts, freight capitalization, inventory costing, and payment clearing accounts require explicit policy decisions before implementation. A sale's cost must come from a reliable cost snapshot or inventory valuation method; it must not be guessed from current product purchase price.

## Data model (proposed)

- `accounts`: owner_id, code, name, account_type, normal_balance, is_system, is_active.
- `journal_entries`: owner_id, entry_number, effective_at, description, source_type, source_id, idempotency_key, status, reversal_of, created_by, created_at.
- `journal_lines`: journal_entry_id, owner_id, account_id, debit, credit, memo, party_type, party_id.
- `accounting_settings`: owner_id, base_currency, books_start_date, accounting_basis, initialized_at.
- Optional `accounting_opening_balances`: owner_id, account_id, as_of_date, debit, credit, approval metadata.

The final SQL types and foreign keys must be aligned to the actual production schema. Journal line amounts use fixed-precision numeric, never floating point.

## Phased implementation within Phase 2

1. Inspect production table definitions, constraints, RLS policies, triggers, RPC signatures, payment-method values, currency/tax behavior, and existing opening-balance semantics.
2. Finalize chart of accounts and create ledger tables, indexes, balancing/immutability controls, and owner-safe read policies.
3. Add a single database posting primitive that validates balanced lines, account ownership, positive amounts, source idempotency, and atomicity.
4. Add posting to new events in their existing transaction boundaries: sales, purchases, collections, supplier payments, expenses, capital/drawings, and cash/bank transfers.
5. Introduce owner-approved opening balances as of a chosen date. Do not auto-backfill old transactions in the first cut.
6. Switch cash/bank and receivable/payable summaries to ledger-derived balances only after reconciliation against the operational registers.
7. Add reconciliation reports and owner/cashier regression tests before production rollout.

## Known Phase 1 integration risks to resolve

- The current `cashInHand` value is calculated from sales, account_payments, expenses, startingBalance, and staff expense summaries. It includes Store Credit sales in the sales filter and falls back to totalAmount when paidAmount is absent. This must be replaced, not layered on top of ledger totals.
- The current model has no central bank ledger balance. Payment method strings include Cash, UPI, Bank, Card, and Cheque; mapping rules must be agreed and made explicit.
- The current settings `startingBalance` field is described in the UI type as yesterday's closing balance. It is not a safe accounting opening-balance record without a date and reconciliation.
- The Phase 1 purchase RPC creates an initial supplier payment row for the paid portion. Ensure that it does not get posted twice when purchase posting is added.
- Sales store line-level `costPrice` snapshots in the application type, but the production column and completeness of historical snapshots must be verified.
- Existing customer and supplier due amounts are maintained on source documents. Ledger control-account totals must reconcile to those registers before becoming authoritative.

## Acceptance criteria

- Every new supported financial event creates exactly one balanced journal entry in the same database transaction as the source event.
- Duplicate requests cannot create duplicate source records or journal entries.
- No tenant can read or post another tenant's journal data.
- Posted entries cannot be edited or deleted; reversals preserve the audit trail.
- Cash, bank, receivables and payables reconcile to source registers and are ledger-derived.
- Opening balances are explicit, dated, owner-approved and balance through opening equity.
- Historical records remain unchanged and are clearly distinguished from ledger-posted events.
- Build, migration dry-run/review, SQL tests, and owner/cashier workflows pass before merge.
