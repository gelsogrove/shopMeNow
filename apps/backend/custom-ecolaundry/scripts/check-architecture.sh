#!/usr/bin/env bash
# check-architecture.sh — enforces the 8 iron rules from CLAUDE.md.
#
# Run from the custom-ecolaundry/ directory:
#   bash scripts/check-architecture.sh
#
# Rules enforced:
#   #1  No new "DO NOT" / "NEVER" / "MUST NOT" added to prompts/agent.txt
#       without a "// approved-by-andrea: <reason>" marker on the same
#       or previous line. (Catches prompt patches; legitimate boundary
#       rules can opt in by adding the marker.)
#   #3  No file in utils/ exceeds 150 lines. Add to ALLOWED_LARGE_FILES
#       below ONLY with explicit Andrea approval, and prefer splitting.
#   #4  No inline mutations of pendingClosure / operatorRequested /
#       pendingEscalation / customerNameRequested / escalationReason
#       outside utils/state-transitions.ts.
#   #5  Every utils/<detector>.ts has a sibling __tests__/unit/<detector>.test.ts.
#
# Exit non-zero on any violation. Used by the root pre-commit hook.

set -e

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

errors=0

echo -e "${YELLOW}🔍 Custom-ecolaundry architecture checks...${NC}"

# --- Rule #1 — prompt patches ------------------------------------------------
# Look for "DO NOT" / "NEVER" / "MUST NOT" in agent.txt that are NOT
# accompanied (same or previous line) by an "approved-by-andrea" marker.
# Each unapproved match is a behavioural patch that should live in code.
echo -n "  [#1] prompt patches in agent.txt... "
prompt_file="prompts/agent.txt"
if [ -f "$prompt_file" ]; then
  unauthorised=$(awk '
    {
      # Track whether the immediately previous line (NR-1) carried the
      # approval marker so the directive on this line counts as approved.
      cur_approved = (prev_marker == 1)
      prev_marker = 0
      if (index($0, "approved-by-andrea") > 0) {
        prev_marker = 1
        if (index($0, "DO NOT") == 0 && index($0, "NEVER") == 0 && index($0, "MUST NOT") == 0) {
          next
        }
        cur_approved = 1
      }
      if (cur_approved) next
      if (index($0, "DO NOT") > 0 || index($0, "NEVER") > 0 || index($0, "MUST NOT") > 0) {
        # Skip if it appears inside a quoted example of customer/bot text
        # (lines starting with "User:" or "Bot:" / quoted dialogue).
        if ($0 ~ /^[[:space:]]*(User|Bot|Customer):/) next
        print FILENAME ":" NR ": " $0
      }
    }
  ' "$prompt_file")
  if [ -n "$unauthorised" ]; then
    count=$(echo "$unauthorised" | wc -l | tr -d ' ')
    echo -e "${RED}✗${NC}"
    echo -e "    ${RED}$count unapproved 'DO NOT/NEVER/MUST NOT' rules in $prompt_file${NC}"
    echo -e "    ${YELLOW}Each behavioural rule should live in code (guard/post-processor/tool validator).${NC}"
    echo -e "    ${YELLOW}If genuinely a boundary rule, add a comment 'approved-by-andrea: <reason>' on the line above.${NC}"
    echo "$unauthorised" | head -5 | sed 's/^/      /'
    if [ "$count" -gt 5 ]; then
      echo -e "      ${YELLOW}... and $((count - 5)) more${NC}"
    fi
    errors=$((errors + 1))
  else
    echo -e "${GREEN}✓${NC}"
  fi
fi

# --- Rule #3 — file size > 150 lines ----------------------------------------
echo -n "  [#3] utils/* file size <= 150 lines... "
# Files allowed to exceed the limit. Each entry needs a documented reason.
# Reduce this list over time; never expand it without explicit Andrea approval.
ALLOWED_LARGE_FILES="
  utils/flow-engine.ts          # JSON-driven flow engine (single responsibility, but algorithmic)
  utils/agent-tools.ts          # OpenAI tool schema declarations (one big object)
  utils/runtime.ts              # Boot loader + validators (single responsibility)
  utils/router.ts               # F31 branch + subCase classifier (single LLM call, schema validator, fallback). Single concern — splitting would fragment the contract.
  utils/state.ts                # Session state factory + reset helpers (F38: resetIncidentDetails vs resetMachineFacts variants). Single concern — splitting would fragment the state invariants.
  utils/agent-extract.ts        # Auto-fact extraction (multi-language detectors, single concern)
  utils/intent.ts               # Display token / intent classification (single concern)
  utils/escalation.ts           # Operator handover summary builder (single concern, branching by incident)
  utils/guards/display-flow.ts  # Phase A+B+C display-flow engine (single responsibility; Phase C re-ask added for Scenario 5.3/7.2)
  utils/guards/display.ts       # Display-state guards: no-photo, numeric codes, post-instruction failure, unknown-display (single concern)
  utils/guards/index.ts         # Pipeline assembly only — imports + ordered GUARD_PIPELINE array. Splitting hurts readability of the priority order.
  utils/guards/force-gather.ts  # All "force-*" gather guards (location/type/number/payment/display) — single concern: each forces the next missing fact. Display has retry+escalate counter.
  utils/guards/payment-double-charge.ts  # Caso 6 multi-step double-charge gather (used? → narrative → 4 digits → receipt) with branch on yes/no AND validation+retry on 4 digits. Single concern: drive the doble-cobro flow end-to-end.
  utils/guards/discount-code-flow.ts  # Caso 8 discount-code multi-step flow (ask → format-validate with retry+escalate ladder → name → pueblo → machine → door → handover). Single concern: drive the código de descuento flow end-to-end.
  utils/guards/payment-no-change.ts  # Caso 4 no-change multi-step flow (ask → no-cambio retry → confirmation → resolved/escalate). Single concern: drive the no-change flow end-to-end.
  utils/guards/invoice-flow.ts  # Caso 9 invoice multi-step flow (location → tipo → razón → dir → CIF → fecha → coste → email retry → notas → name → handover). F42 added coste step. Single concern: drive the factura flow end-to-end.
  utils/state-transitions.ts  # Named atomic state transitions (markResolved, escalate, markRefundFormPending, captureCustomerName, …). Single responsibility — splitting fragments the auditable surface that rule #4 protects.
  utils/human-message-email.ts  # HTML email template + nodemailer sender for operator notifications. Single responsibility — the bulk is inline CSS/HTML which cannot be split meaningfully.
  utils/agent-rephrase.ts       # L5 polish layer + F72/F74/F75 deterministic display-flow recap (RECAP_STRINGS × 6 languages × ~10 lines each + buildDisplayRecap + rephraseForTurn). Single concern — splitting would fragment the contract between determinism and LLM polish.
  utils/guards/location-resolution.ts  # F82 added Mataró street-insist branch (MATARO_DONT_KNOW_RE + landmark lookup). Four related guards (mataroStreet, unknownLocation, forceLocation, insistLocation) share single concern: location resolution pipeline.
  utils/faq-location-formatter.ts  # F87 — re-exports from faq-programs-formatter + faq-payment-formatter for backward compatibility; hours + prices formatters with payment signal appending. Single concern: format FAQ replies per location. Splitting prices into 3 files (hours/washer/dryer) would fragment a single coherent story.
  utils/guards/faq-prices.ts  # F88 — Caso 12.2 multi-phase FAQ prices flow (T1 detect + T2 location reply + T3 dryer-confirm + T3 washer-confirm + renderPrices). F87 grew to ~163 lines for buildTranslateFn; F88 grew to ~202 lines for isIncomprehensible + isNegative helpers and repeat logic in both confirm guards (truncated messages repeat the question instead of closing). Single concern: drive the prices FAQ flow end-to-end.
  utils/guards/loyalty-card-buy.ts  # Caso 36 — TARJETA_TOPIC regex (with 6-lang coverage + F25/F44/F93 extensions) + detectBuyLocationInMessage + guardLoyaltyCardBuy (T1, with cross-location branch) + guardLoyaltyCardBuyAwaitLocation (T2). T1 and T2 share TARJETA_TOPIC and helpers — splitting would require cross-import between sibling files, fragmenting the single-Caso contract. 171 lines, single concern.
  utils/message-parsing/locations.ts  # Caso 36 — resolveKnownLocation + resolveAllKnownLocations (new: returns all matches in message for cross-location detection) + resolveKnownLocationFuzzy all share KNOWN_LOCATIONS + ALIAS_TO_CANONICAL module-level data structures. Splitting would require duplicating those maps across files. Single concern: location name resolution from free text. 189 lines.
"
ALLOWED_LARGE_FILES=$(echo "$ALLOWED_LARGE_FILES" | sed 's/#.*$//' | tr -s ' \n' ' ')
violations=""
while IFS= read -r f; do
  rel="${f#$ROOT/}"
  if echo " $ALLOWED_LARGE_FILES " | grep -q " $rel "; then
    continue
  fi
  lines=$(wc -l < "$f" | tr -d ' ')
  if [ "$lines" -gt 150 ]; then
    violations="$violations\n      $rel ($lines lines)"
  fi
done < <(find "$ROOT/utils" -maxdepth 2 -name "*.ts" -not -path "*/node_modules/*")

if [ -n "$violations" ]; then
  echo -e "${RED}✗${NC}"
  echo -e "    ${RED}Files exceed 150 lines (split into cassettes):${NC}"
  echo -e "$violations"
  errors=$((errors + 1))
else
  echo -e "${GREEN}✓${NC}"
fi

# --- Rule #4 — inline state mutations ---------------------------------------
echo -n "  [#4] state mutations only via state-transitions.ts... "
inline=$(grep -rEn 'ar\.state\.(pendingClosure|operatorRequested|pendingEscalation|customerNameRequested|escalationReason)\s*=[^=]' \
  "$ROOT/utils" "$ROOT/agent.ts" 2>/dev/null \
  | grep -v "state-transitions.ts" \
  | grep -v "^[^:]*://" || true)

if [ -n "$inline" ]; then
  count=$(echo "$inline" | wc -l | tr -d ' ')
  echo -e "${RED}✗${NC}"
  echo -e "    ${RED}$count inline mutations of state outside state-transitions.ts:${NC}"
  echo "$inline" | sed 's/^/      /'
  echo -e "    ${YELLOW}Use markResolved/escalate/requireCustomerName/resetPostEscalationFlags/resetForNewIncident.${NC}"
  errors=$((errors + 1))
else
  echo -e "${GREEN}✓${NC}"
fi

# --- Rule #5 — every detector has a sibling test ----------------------------
echo -n "  [#5] every utils/<detector>.ts has a sibling unit test... "
# These are infra/glue, not detectors — exempt from the test-sibling rule.
EXEMPT="agent-llm cli llm-fetch logger runtime localization message-parsing locations agent-prompt agent-welcome agent-rephrase operator-briefing display-state llm relative-date agent-tools agent-extract router-prompt faq-location-formatter faq-programs-formatter faq-payment-formatter"
# agent-tools: pure OpenAI tool schema declarations, no logic to test.
# agent-extract: multi-language extractor cassette covered indirectly by
#   __tests__/agent/* E2E tests; pure-unit tests would duplicate them.
# router-prompt: pure prompt string constant for utils/router.ts, no logic.
# faq-location-formatter: pure formatter helpers (prices+hours); tested
#   indirectly by __tests__/unit/faq-location-formatter.test.ts (F50).
# faq-programs-formatter: pure formatter for programs (Caso 12.4/F81);
#   tested by __tests__/unit/faq-programs.test.ts which imports formatWasherPrograms
#   and formatDryerPrograms directly (re-exported via faq-location-formatter.ts).
# faq-payment-formatter: pure formatter for payment boundary signals (F87,
#   Caso 12.2 cardOnly + tpvExact); tested by __tests__/unit/faq-location-formatter.test.ts
#   which imports readPayment + tests the integration with formatWasherPrices /
#   formatDryerPrices (re-exported via faq-location-formatter.ts).
missing=""
while IFS= read -r f; do
  base="$(basename "$f" .ts)"
  if echo " $EXEMPT " | grep -q " $base "; then
    continue
  fi
  test_file="$ROOT/__tests__/unit/${base}.test.ts"
  if [ ! -f "$test_file" ]; then
    missing="$missing\n      utils/${base}.ts"
  fi
done < <(find "$ROOT/utils" -maxdepth 1 -name "*.ts" -not -path "*/node_modules/*")

if [ -n "$missing" ]; then
  echo -e "${RED}✗${NC}"
  echo -e "    ${RED}Detectors without sibling tests in __tests__/unit/:${NC}"
  echo -e "$missing"
  echo -e "    ${YELLOW}Add the test file or add the basename to EXEMPT in this script (with reason).${NC}"
  errors=$((errors + 1))
else
  echo -e "${GREEN}✓${NC}"
fi

# --- Rule #9 — no `casoN` ordinal references in code -----------------------
# The doc (docs/usecases.md) and the bridge file (json/cases.json) are the
# ONLY places where ordinal "Caso N" labels are allowed. Anywhere else they
# create coupling between doc ordering and code, breaking the moment a case
# is renumbered. Use a semantic id from cases.json instead.
echo -n "  [#9] no 'casoN' ordinal refs in code (semantic naming)... "
ordinal=$(grep -rEn 'caso[0-9]|case[0-9]+(?!-)' \
  utils agent.ts index.ts models json prompts \
  --include='*.ts' --include='*.json' --include='*.txt' 2>/dev/null \
  | grep -v 'json/cases\.json' \
  | grep -v 'docs/' \
  | grep -v '^[^:]*:.*\(case\|caso\)\(_\|s\)' \
  | grep -v 'case_sel\|case_push\|case_door\|case_alm\|case_al001\|case_end\|case_blank\|case_extra' || true)

if [ -n "$ordinal" ]; then
  count=$(echo "$ordinal" | wc -l | tr -d ' ')
  echo -e "${RED}✗${NC}"
  echo -e "    ${RED}$count ordinal 'casoN'/'caseN' references in code (use semantic ids):${NC}"
  echo "$ordinal" | head -5 | sed 's/^/      /'
  if [ "$count" -gt 5 ]; then
    echo -e "      ${YELLOW}... and $((count - 5)) more${NC}"
  fi
  echo -e "    ${YELLOW}Map ordinal → semantic via json/cases.json. Code uses semanticId.${NC}"
  errors=$((errors + 1))
else
  echo -e "${GREEN}✓${NC}"
fi

# --- Rule #11 — every F-log entry has a regression pin ---------------------
# Every entry in CLAUDE.md "Architectural fixes log" MUST have at least one
# pin in __tests__/unit/f-log-regression.test.ts. The pin's `name` must
# start with the F-number. This guarantees that reverting a past fix fails
# LOUDLY with a test name that points directly to the F-log entry.
#
# EXEMPT_F_ENTRIES: legacy entries that predate this discipline (F1-F16)
# OR are LLM-dependent (no deterministic pin possible). When adding to this
# list, document the reason inline.
echo -n "  [#11] every F-log entry has a pin in f-log-regression.test.ts... "
EXEMPT_F_ENTRIES="
  F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 F13 F14 F15 F16  # Legacy (pre-F17 discipline) — covered by dedicated unit tests
  F31  # Router subCase classification — LLM-dependent, no deterministic pin
  F37  # PDF-strict alignment — reverted by F40 (UX > PDF for PUSH PROG)
"
EXEMPT_F_ENTRIES=$(echo "$EXEMPT_F_ENTRIES" | sed 's/#.*$//' | tr -s ' \n' ' ')
pin_file="__tests__/unit/f-log-regression.test.ts"
if [ -f CLAUDE.md ] && [ -f "$pin_file" ]; then
  flog_entries=$(grep -oE '^\| F[0-9]+ ' CLAUDE.md | grep -oE 'F[0-9]+' | sort -u)
  pinned=$(grep -oE 'F[0-9]+' "$pin_file" | sort -u)
  missing=""
  for f in $flog_entries; do
    # Skip exempt entries
    if echo " $EXEMPT_F_ENTRIES " | grep -q " ${f} "; then
      continue
    fi
    if ! echo "$pinned" | grep -q "^${f}$"; then
      missing="$missing $f"
    fi
  done
  if [ -n "$missing" ]; then
    echo -e "${RED}✗${NC}"
    echo -e "    ${RED}F-log entries without regression pin:${NC}$missing"
    echo -e "    ${YELLOW}Add a pin in __tests__/unit/f-log-regression.test.ts with the F-number in its name.${NC}"
    echo -e "    ${YELLOW}If genuinely impossible to pin deterministically, add to EXEMPT_F_ENTRIES with reason.${NC}"
    errors=$((errors + 1))
  else
    echo -e "${GREEN}✓${NC}"
  fi
else
  echo -e "${YELLOW}skipped (CLAUDE.md or pin file missing)${NC}"
fi

# --- Caso 1 contract — PUSH PROG dynamic program list per location ----------
# The Caso 1 (PUSH PROG) reply is built dynamically per-location from
# json/locations.json:metadata.programs.washers, formatted by
# utils/faq-programs-formatter.ts:formatWasherPrograms, and injected into
# the flow-engine prompt by utils/guards/auto-start-machine-flow.ts via
# buildPushProgList. Changing any of these three pieces without discussion
# breaks the Caso 1 contract documented in docs/usecases.md (Caso 1 §1.1)
# and the CSV source-of-truth at docs/csv/programes.csv.
#
# This check is a tripwire: if Goya loses its `programs.washers` block,
# or the guard stops calling `buildPushProgList`, or the formatter is
# renamed/inlined elsewhere — the build fails and Andrea is asked first.
echo -n "  [C1] Caso 1 PUSH PROG contract (locations.programs + formatter + guard)... "
caso1_errors=""

# C1.a — Every location currently defined in locations.json MUST keep its
# metadata.programs.washers block. The list is derived from the file itself
# (top-level object keys under "locations"), so adding a new laundry
# automatically extends the guard. Source of truth for content:
# docs/csv/programes.csv.
location_keys=$(awk '
  /^  "locations":/ { in_locs=1; next }
  in_locs && /^    "[A-Za-z]+":[[:space:]]*\{/ {
    match($0, /"[A-Za-z]+"/)
    print substr($0, RSTART+1, RLENGTH-2)
  }
' json/locations.json)
for loc in $location_keys; do
  slice=$(awk -v key="\"$loc\":" '
    $0 ~ key { capture=1 }
    capture && /^    "[A-Za-z]+":[[:space:]]*\{/ && $0 !~ key { exit }
    capture { print }
  ' json/locations.json)
  if ! echo "$slice" | grep -q '"programs"' || ! echo "$slice" | grep -q '"washers"'; then
    caso1_errors="$caso1_errors\n      json/locations.json: location '$loc' missing metadata.programs.washers"
  fi
done

# C1.b — formatWasherPrograms must stay in faq-programs-formatter.ts as
# the SINGLE source of the bullet-list format. No hardcoded duplicate
# bullet list with "**N** —" pattern elsewhere in utils/.
duplicates=$(grep -rEn '^\s*-\s\*\*[0-9]+\*\*\s—' utils/ --include='*.ts' 2>/dev/null \
  | grep -v 'faq-programs-formatter.ts' || true)
if [ -n "$duplicates" ]; then
  caso1_errors="$caso1_errors\n      hardcoded program bullet list outside faq-programs-formatter.ts:\n$(echo "$duplicates" | sed 's/^/        /')"
fi

# C1.c — auto-start-machine-flow.ts must keep calling buildPushProgList
# for display=PUSH; without this call the per-location dynamic list is
# lost and every laundry falls back to the generic hardcoded prompt.
guard_file="utils/guards/auto-start-machine-flow.ts"
if [ -f "$guard_file" ]; then
  # Word-boundary match: `buildPushProgList(` as an actual call, not just
  # a substring (so a rename like buildPushProgListDISABLED is caught).
  if ! grep -qE '\bbuildPushProgList\s*\(' "$guard_file"; then
    caso1_errors="$caso1_errors\n      $guard_file: missing call to buildPushProgList(...) (per-location PUSH PROG list disabled)"
  fi
  if ! grep -qE "['\"]PUSH['\"]" "$guard_file"; then
    caso1_errors="$caso1_errors\n      $guard_file: missing 'PUSH' display check (dynamic list injection branch removed)"
  fi
else
  caso1_errors="$caso1_errors\n      $guard_file missing (Caso 1 auto-start guard removed)"
fi

if [ -n "$caso1_errors" ]; then
  echo -e "${RED}✗${NC}"
  echo -e "    ${RED}Caso 1 contract violations:${NC}"
  echo -e "$caso1_errors"
  echo -e "    ${YELLOW}Each laundry has a custom program layout (docs/csv/programes.csv).${NC}"
  echo -e "    ${YELLOW}Discuss with Andrea before changing the formatter, the guard, or the locations.json programs block.${NC}"
  errors=$((errors + 1))
else
  echo -e "${GREEN}✓${NC}"
fi

# --- summary ----------------------------------------------------------------
echo
if [ "$errors" -gt 0 ]; then
  echo -e "${RED}❌ $errors architecture rule(s) violated. Commit aborted.${NC}"
  echo -e "${YELLOW}   Read CLAUDE.md → 'The 8 iron rules' for the why.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ All architecture checks passed.${NC}"
