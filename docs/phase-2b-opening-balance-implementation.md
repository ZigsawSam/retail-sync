# Phase 2B implementation notes — opening balance staging

## What this migration adds

Migration: `supabase/migrations/20261115_phase2b_opening_balance_staging.sql`

- One owner-scoped opening balance batch, fixed to 2026-08-31 close / 2026-09-01 books start.
- Itemized cash, bank, clearing, equity and other account balances.
- Product-wise inventory opening value with quantity and unit-cost evidence.
- Customer-wise receivables and supplier-wise payables.
- Owner-scoped read access; direct client writes are revoked.
- Owner-authenticated RPCs to create a draft batch, validate it, and post it once.
- Posting delegates to the Phase 2A balanced journal function and uses a stable source identity.

## Input contract

Call `create_accounting_opening_balance_batch(notes, items)` with JSON items:

- General account line: `item_type: "account"`, `account_code`, `debit`, `credit`; do not use control account codes 1100, 1200, or 2000.
- Inventory: `item_type: "inventory"`, `reference_id` = product ID, `quantity` = base-unit quantity, `unit_cost` = verified cost per base unit, `debit` = quantity × unit cost.
- Customer due: `item_type: "customer_receivable"`, `reference_id` = customer ID, positive `debit`.
- Supplier due: `item_type: "supplier_payable"`, `reference_id` = supplier UUID, positive `credit`.

Use separate lines for cash (1000), bank (1010), payment clearing (1020), owner capital (3000), drawings (3100), opening balance equity (3900), and other supported balance-sheet accounts. Opening equity is not a substitute for evidence of capital or profit.

## RPC sequence

1. `create_accounting_opening_balance_batch(notes, items)`
2. `validate_accounting_opening_balance_batch(batch_id)`
3. Review the returned totals and source details.
4. `post_accounting_opening_balance_batch(batch_id)`

The post routine only accepts an INR ledger initialized for 2026-09-01. It posts the opening entry at midnight India Standard Time on 2026-09-01.

## Important limitations / release blockers

- This is a database staging/posting foundation, not a completed user-facing opening balance screen.
- The migration has not been executed in production or validated against a disposable Supabase project.
- No opening balances are populated by this migration.
- No historical transaction import is included.
- Product cost/quantity evidence still needs to be independently verified; current product purchasePrice is not treated as proof.
- Supplier IDs are expected to be UUIDs, consistent with the inspected production schema.
- This migration depends on the Phase 2A ledger migration being installed first.
- The existing Phase 2A journal posting function is not directly executable by authenticated clients; this opening-balance posting RPC calls it within a SECURITY DEFINER routine. Verify function ownership and execute privileges during database validation.
- Existing Phase 2A journal immutability uses a custom transaction setting as a trigger gate. Client table write privileges are revoked, but the custom setting is not a cryptographic trust boundary for privileged database roles. Harden the posting boundary before production cutover.
- The current database schema does not establish a complete historical stock movement register. Opening inventory must be supported by a dated stock count or verified stock ledger.

## Required tests before production

- Initialize INR books for 2026-09-01.
- Create a batch containing cash, bank, product-wise inventory, customer dues, supplier dues and equity lines.
- Reject a product/customer/supplier belonging to another owner.
- Reject missing or non-positive inventory quantity/cost and mismatched extended value.
- Reject attempts to provide aggregate-only AR, inventory or AP lines.
- Reject unbalanced batch totals.
- Reject second batch for the same owner.
- Reject posting before validation and repeated posting.
- Verify journal debits equal credits and party/product detail totals equal their control accounts.
- Verify authenticated owner can read only their own batch/items and cannot insert/update/delete directly.
- Run in a disposable Supabase project first; production SQL Editor is not the test environment.
