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
inline=$(grep -rEn 'ar\.state\.(pendingClosure|operatorRequested|pendingEscalation|customerNameRequested|escalationReason)\s*=' \
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
EXEMPT="agent-llm cli llm-fetch logger runtime localization message-parsing locations agent-prompt agent-welcome display-state llm relative-date agent-tools agent-extract router-prompt"
# agent-tools: pure OpenAI tool schema declarations, no logic to test.
# agent-extract: multi-language extractor cassette covered indirectly by
#   __tests__/agent/* E2E tests; pure-unit tests would duplicate them.
# router-prompt: pure prompt string constant for utils/router.ts, no logic.
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

# --- summary ----------------------------------------------------------------
echo
if [ "$errors" -gt 0 ]; then
  echo -e "${RED}❌ $errors architecture rule(s) violated. Commit aborted.${NC}"
  echo -e "${YELLOW}   Read CLAUDE.md → 'The 8 iron rules' for the why.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ All architecture checks passed.${NC}"
