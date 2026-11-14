# Phase 2B — Opening Balances and Retroactive Ledger Cutover

## Approved accounting basis

- Base currency: INR.
- Books start date: **2026-09-01**.
- Opening balance measurement date: **2026-08-31 close**.
- Historical reconstruction window: **2026-09-01 through 2026-11-14 inclusive** (the approved cutover decision was made on 2026-11-14).
- Existing operational records must remain intact. No historical rows are to be overwritten or deleted.

## Cutover model

The opening balance is the verified closing position at 2026-08-31. It is posted once as a balanced opening journal entry dated 2026-09-01. Transactions dated from 2026-09-01 onward are then reconstructed and posted as historical journal entries in original business-date order.

Do not post both:
1. the full opening balances as of 2026-08-31, and
2. transactions dated before 2026-09-01.

That would double-count the pre-start position.

Historical transactions from 2026-09-01 onward must be reconstructed from source documents and payment events. Never infer missing events from current balances alone.

## Opening balance components and evidence

| Component | Ledger treatment | Required evidence |
|---|---|---|
| Cash on hand | Debit Cash | Physical cash count / signed cashbook close at 2026-08-31 |
| Bank | Debit Bank | Bank statement balance and reconciliation at 2026-08-31 |
| Payment settlement clearing | Debit/credit clearing as appropriate | UPI/card/cheque settlements in transit at 2026-08-31; do not classify unsettled receipts as bank cash |
| Inventory | Debit Inventory | Product-wise quantity at 2026-08-31 × verified cost per base unit; retain unit conversion and valuation method |
| Customer dues | Debit Accounts Receivable | Customer-wise unpaid invoice balance at 2026-08-31; tie to invoice register |
| Supplier dues | Credit Accounts Payable | Supplier-wise unpaid invoice balance at 2026-08-31; tie to purchase register |
| Owner capital | Credit Owner Capital only for verified contributed capital | Owner funding records / capital account evidence |
| Opening balance equity | Balancing equity line only for unexplained opening net position | Explicitly label as temporary reconciliation balance; do not call it owner capital or profit |

Opening inventory must not be valued using today's product purchasePrice unless the owner verifies that it is the correct 2026-08-31 cost. The stock quantity must be in base units. Product-wise details must sum exactly to the Inventory control account.

Customer and supplier opening detail must include stable party IDs and sum exactly to the Accounts Receivable and Accounts Payable control accounts. Unmatched or deleted parties must be flagged for resolution, not silently grouped into a generic customer/supplier.

## Historical reconstruction window

For 2026-09-01 through 2026-11-14, reconstruct and reconcile:

- Sales invoices: invoice date, customer, items, discounts/tax, paid amount, due amount, payment method, cost snapshot.
- Customer collections: actual receipt date, amount, method, allocation to invoice(s), and idempotency/source reference.
- Purchase invoices: purchase date, supplier, items, quantities, unit costs, freight, paid amount and due amount.
- Supplier payments: actual payment date, amount, method, allocation to purchase(s).
- Expenses: date, category, amount, payment method, and supporting record.
- Owner capital introduced and drawings, where documented.
- Bank/UPI/card/cheque settlement transfers, where supported by statements.
- Stock adjustments, returns, damaged goods, and other inventory movements, where recorded.

A purchase's initial supplier payment row in account_payments is evidence of the paid portion of that purchase, not a second independent payment. Likewise, a collection row that updates sales.paidAmount must not be counted again as a separate receipt in addition to the invoice's paid amount. Reconstruct the underlying event once.

For each transaction type, define one canonical source event and one deterministic source key. Re-running the import must be idempotent. If source documents are edited or deleted after posting, corrections must be represented through reversal and replacement entries; do not mutate posted journal rows.

## Inventory costing gate

A reliable COGS posting requires a cost basis at the sale date. Use a verified line-level cost snapshot or an explicitly selected costing method (e.g. weighted average) that can be calculated from complete stock movements. Do not use current product purchasePrice as a proxy for historical sale cost. Flag sales with missing cost evidence and do not mark gross profit reports complete until resolved.

## Reconciliation gates before ledger-derived dashboards

All checks must pass before switching cash, bank, inventory, receivables, payables, or profit summaries to ledger balances:

1. Opening journal is balanced and posted exactly once.
2. Opening inventory detail = Inventory control account; quantities reconcile to the 2026-08-31 stock count.
3. Opening customer detail = Accounts Receivable; opening supplier detail = Accounts Payable.
4. Reconstructed sales and purchases match invoice registers by count and total.
5. Collections and supplier payments match account_payments without duplicate counting.
6. Cash and bank movement totals reconcile to cashbook and bank statements, with settlement clearing separately reconciled.
7. Inventory movements reconcile to opening stock + receipts − sales/returns/adjustments = closing stock.
8. Debits equal credits for every journal entry and for the complete ledger.
9. Exceptions are listed with source IDs, amount, date, reason, and resolution status.
10. Owner signs off the opening snapshot and historical reconstruction report.

## Implementation sequence

1. Add staging tables for an owner-scoped opening-balance batch and its supporting product/party detail.
2. Add an owner-authorized validation/posting routine that checks the exact books start date, one-time posting, control-account totals, party/product ownership, positive amounts, and balanced journal lines.
3. Add a read-only historical reconciliation report/import preview before allowing posting.
4. Add idempotent historical posting in batches, with immutable source references and transaction-level error reporting.
5. Add reversal/replacement support before allowing changes to posted historical events.
6. Run reconciliation and owner/cashier workflow tests.
7. Switch dashboard balances only after all applicable gates pass.

## Non-goals and safety

- No automatic backfill based on current totals.
- No use of today's stock or purchase prices as historical opening evidence.
- No use of Opening Balance Equity as a disguised owner-capital or profit figure.
- No dashboard switch while opening or historical reconciliation exceptions remain.
- No production migration or posting until SQL validation, code review, and explicit owner approval.
