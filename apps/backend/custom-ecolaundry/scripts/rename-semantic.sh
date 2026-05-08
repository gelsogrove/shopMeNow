#!/usr/bin/env bash
# rename-semantic.sh — One-shot rename of all `casoN` references to
# semantic, behaviour-describing names.
#
# Run from custom-ecolaundry/. Modifies in-place. Run typecheck after.
#
# Order matters: longest patterns FIRST so a shorter pattern doesn't
# accidentally match a substring of a longer one.

set -e

cd "$(dirname "$0")/.."

# Files to rename in: utils/, agent.ts, json/, __tests__/, prompts/, models/, docs/
FILES=$(find utils agent.ts index.ts models json __tests__ prompts docs \
  -type f \( -name "*.ts" -o -name "*.json" -o -name "*.txt" -o -name "*.md" \) \
  2>/dev/null)

# sed -i syntax differs between GNU and BSD. Use a portable wrapper.
sedi() {
  sed -i.bak "$@"
}

# Mappings — keep camelCase variants together with kebab variants.
# Order: longest first within each group.

apply() {
  local from="$1"
  local to="$2"
  echo "  $from → $to"
  for f in $FILES; do
    sedi "s|${from}|${to}|g" "$f"
  done
}

echo "🔧 Renaming pendingFlow / reason kebab markers..."
# Caso 8 — discount code (multi-step, longest first to avoid substring conflicts)
apply "'caso8-await-machine-number'" "'discount-code-await-machine'"
apply "'caso8-await-name'" "'discount-code-await-name'"
apply "'caso8-await-pueblo'" "'discount-code-await-location'"
apply "'caso8-await-puerta'" "'discount-code-await-door'"
apply "'caso8-await-code'" "'discount-code-await'"
apply "'caso8-ask-code'" "'discount-code-ask'"
# Reason markers (within reason: '...')
apply "reason: 'caso8-final'" "reason: 'discount-code-final'"
apply "reason: 'caso8-escalate'" "reason: 'discount-code-escalate'"
apply "reason: 'caso8-await-name-reask'" "reason: 'discount-code-await-name-reask'"
apply "reason: 'caso8-ask-puerta'" "reason: 'discount-code-ask-door'"
apply "reason: 'caso8-ask-pueblo'" "reason: 'discount-code-ask-location'"
apply "reason: 'caso8-ask-machine-number'" "reason: 'discount-code-ask-machine'"
apply "reason: 'caso8-ask-name'" "reason: 'discount-code-ask-name'"
apply "reason: 'caso8-ask-code'" "reason: 'discount-code-ask'"

# Caso 9 — invoice
apply "'caso9-ask-machine-type'" "'invoice-ask-machine-type'"
apply "'caso9-ask-razon-social'" "'invoice-ask-company-name'"
apply "'caso9-ask-lavanderia'" "'invoice-ask-location'"
apply "'caso9-ask-direccion'" "'invoice-ask-address'"
apply "'caso9-ask-fecha'" "'invoice-ask-date'"
apply "'caso9-ask-email'" "'invoice-ask-email'"
apply "'caso9-ask-name'" "'invoice-ask-name'"
apply "'caso9-ask-cif'" "'invoice-ask-tax-id'"
apply "'caso9-'" "'invoice-'"
apply "reason: 'caso9-factura-final'" "reason: 'invoice-final'"
apply "reason: 'caso9-factura'" "reason: 'invoice'"

# Caso 6 — double charge
apply "'caso6-ask-podido-lavar'" "'double-charge-ask-used'"
apply "'caso6-ask-4-digitos'" "'double-charge-ask-card-digits'"
apply "'caso6-ask-captura'" "'double-charge-ask-receipt'"
apply "'caso6-ask-relato'" "'double-charge-ask-narrative'"
apply "'caso6-'" "'double-charge-'"
apply "reason: 'caso6-ask-podido-lavar'" "reason: 'double-charge-ask-used'"
apply "reason: 'caso6-ask-4-digitos'" "reason: 'double-charge-ask-card-digits'"
apply "reason: 'caso6-ask-captura'" "reason: 'double-charge-ask-receipt'"
apply "reason: 'caso6-ask-relato'" "reason: 'double-charge-ask-narrative'"

# Caso 4 — no change after pay
apply "'caso4-await-cambio'" "'no-change-await-confirm'"
apply "'caso4-ask-cambio'" "'no-change-ask'"
apply "reason: 'caso4-ask-cambio'" "reason: 'no-change-ask'"

# Caso 7 — paid not used
apply "'caso7-await-display'" "'paid-not-used-await-display'"
apply "'caso7-ask-cambio'" "'paid-not-used-ask-change'"
apply "reason: 'caso7-ask-cambio'" "reason: 'paid-not-used-ask-change'"

# Display flow ids
apply "'caso5-al001'" "'al001-sequence-error'"
apply "'caso14-alm-door'" "'alm-door-blocked'"
apply "'caso15-001-explained'" "'code-001-explained'"
apply '"caso5-al001"' '"al001-sequence-error"'
apply '"caso14-alm-door"' '"alm-door-blocked"'
apply '"caso15-001-explained"' '"code-001-explained"'

# Reason strings for display-flow guards
apply "\${flow.id}-resolved" "\${flow.id}-resolved"
apply "\${flow.id}-escalate" "\${flow.id}-escalate"

# Other reason strings
apply "reason: 'caso10-tarjeta-base'" "reason: 'loyalty-card-buy-base'"
apply "reason: 'caso10-tarjeta-override-direct'" "reason: 'loyalty-card-buy-override-direct'"
apply "reason: 'caso10-tarjeta-override'" "reason: 'loyalty-card-buy-override'"
apply "reason: 'caso11-recarga'" "reason: 'loyalty-card-recharge'"
apply "reason: 'caso12-precio'" "reason: 'pricing-deflect'"
apply "reason: 'caso12-horarios'" "reason: 'opening-hours'"
apply "reason: 'caso25-empathic'" "reason: 'angry-customer-empathic'"
apply "reason: 'caso25-escalate'" "reason: 'angry-customer-escalate'"
apply "reason: 'caso26-ask-refund-data'" "reason: 'refund-ask-data'"
apply "reason: 'caso26-escalate'" "reason: 'refund-escalate'"
apply "reason: 'caso27-review'" "reason: 'compensation-review'"
apply "reason: 'caso28-contradictory'" "reason: 'contradictory-narrative'"
apply "reason: 'caso31-insist-location'" "reason: 'insist-location-followup'"
apply "reason: 'caso17-ask-photo'" "reason: 'photo-ask'"
apply "reason: 'caso17-no-photo-escalate'" "reason: 'no-photo-escalate'"

echo "🔧 Renaming i18n keys (camelCase)..."
# Long camelCase keys first
apply "caso10TarjetaBase" "loyaltyCardBuyBase"
apply "caso11Recarga" "loyaltyCardRecharge"
apply "caso12HorariosDefault" "openingHoursDefault"
apply "caso12Precio" "pricingDeflect"
apply "caso14AlmDoor" "almDoorGuidance"
apply "caso15Explain" "code001Explain"
apply "caso15Escalate" "code001Escalate"
apply "caso17AskPhoto" "photoAsk"
apply "caso17NoPhotoEscalate" "noPhotoEscalate"
apply "caso25Empathic" "angryCustomerEmpathic"
apply "caso26AskRefundData" "refundAskData"
apply "caso26EscalateNoPromise" "refundEscalateNoPromise"
apply "caso27Review" "compensationReview"
apply "caso2124NotDocHere" "locationGatedNotDocumented"
apply "caso31InsistLocation" "insistLocationFollowUp"
apply "caso4Resolved" "noChangeResolved"
apply "caso5GuideRetry" "al001GuideRetry"
apply "caso5Resolved" "al001Resolved"
apply "caso6AskPodidoLavar" "doubleChargeAskUsed"
apply "caso6AskRelato" "doubleChargeAskNarrative"
apply "caso6Ask4Digitos" "doubleChargeAskCardDigits"
apply "caso6AskCaptura" "doubleChargeAskReceipt"
apply "caso6Closure" "doubleChargeClosure"
apply "caso8AskMachineNumber" "discountCodeAskMachineNumber"
apply "caso8AskCode" "discountCodeAsk"
apply "caso8AskName" "discountCodeAskName"
apply "caso8AskPueblo" "discountCodeAskLocation"
apply "caso8AskPuerta" "discountCodeAskDoor"
apply "caso8FinalEscalate" "discountCodeFinalEscalate"
apply "caso8FormatInvalid" "discountCodeFormatInvalid"
apply "caso9AskLavanderia" "invoiceAskLocation"
apply "caso9AskMachineType" "invoiceAskMachineType"
apply "caso9AskRazonSocial" "invoiceAskCompanyName"
apply "caso9AskDireccion" "invoiceAskAddress"
apply "caso9AskCif" "invoiceAskTaxId"
apply "caso9AskFecha" "invoiceAskDate"
apply "caso9AskEmailRetry" "invoiceAskEmailRetry"
apply "caso9AskEmail" "invoiceAskEmail"
apply "caso9AskName" "invoiceAskName"
apply "caso9Final" "invoiceFinal"
# State field name
apply "caso8Data" "discountCodeData"

echo "🔧 Renaming guard function names..."
apply "guardCaso2124LocationMismatch" "guardLocationGatedMismatch"
apply "guardCaso6AskPodidoLavar" "guardDoubleChargeAskUsed"
apply "guardCaso6AskRelato" "guardDoubleChargeAskNarrative"
apply "guardCaso6Ask4Digitos" "guardDoubleChargeAskCardDigits"
apply "guardCaso6AskCaptura" "guardDoubleChargeAskReceipt"
apply "guardCaso8AwaitMachineNumber" "guardDiscountCodeAwaitMachine"
apply "guardCaso8AwaitName" "guardDiscountCodeAwaitName"
apply "guardCaso8AwaitPueblo" "guardDiscountCodeAwaitLocation"
apply "guardCaso8AwaitPuerta" "guardDiscountCodeAwaitDoor"
apply "guardCaso8AwaitCode" "guardDiscountCodeAwait"
apply "guardCaso8AskCode" "guardDiscountCodeAsk"
apply "guardCaso25Empathic" "guardAngryCustomerEmpathic"
apply "guardCaso25Escalate" "guardAngryCustomerEscalate"
apply "guardCaso26Refund" "guardRefundOrCompensation"
apply "guardCaso28Contradictory" "guardContradictoryNarrative"
apply "guardCaso31InsistLocation" "guardInsistLocation"
apply "guardCaso17AskPhoto" "guardAskPhoto"
apply "guardCaso10Tarjeta" "guardLoyaltyCardBuy"
apply "guardCaso11Recarga" "guardLoyaltyCardRecharge"
apply "guardCaso12Precio" "guardPricingDeflect"
apply "guardCaso12Horarios" "guardOpeningHours"
apply "guardCaso4AskCambio" "guardNoChangeAsk"
apply "guardCaso7AskCambio" "guardPaidNotUsedAskChange"
apply "guardCaso9Factura" "guardInvoiceFlow"

echo "🔧 Renaming guard import paths..."
apply "from './payment-caso4.js'" "from './payment-no-change.js'"
apply "from './payment-caso6.js'" "from './payment-double-charge.js'"
apply "from './payment-caso7.js'" "from './payment-paid-not-used.js'"
apply "from './payment-caso8.js'" "from './discount-code-flow.js'"
apply "from './payment-caso10.js'" "from './loyalty-card-buy.js'"
apply "from './payment-caso11.js'" "from './loyalty-card-recharge.js'"
apply "from './faq-caso9.js'" "from './invoice-flow.js'"
apply "from './faq-caso12.js'" "from './hours-and-pricing.js'"
apply "from './faq-caso25.js'" "from './angry-customer.js'"
apply "from './faq-caso26.js'" "from './refund-and-compensation.js'"
apply "from './faq-caso28.js'" "from './contradictory-narrative.js'"

echo "🔧 Renaming escalation reason TEXTS..."
# These are human-readable strings the operator sees
apply "Caso 4 — " "No-change incident — "
apply "Caso 5 — AL001 sequence guidance did not resolve" "AL001 sequence error — guidance did not resolve"
apply "Caso 6 doble cobro" "Double charge incident"
apply "Caso 7 — " "Paid-not-used incident — "
apply "Caso 8 — " "Discount code — "
apply "Caso 9 — " "Invoice request — "
apply "Caso 14 — ALM DOOR persists after retry" "ALM DOOR — persists after retry"
apply "Caso 15 — display 001 always escalated" "Display 001 — always escalated"
apply "Caso 25 — " "Angry customer — "
apply "Caso 26 — " "Refund/compensation — "
apply "Caso 28 — " "Contradictory narrative — "

echo "🔧 Cleaning up backup files..."
find utils agent.ts index.ts models json __tests__ prompts docs \
  -name "*.bak" -type f 2>/dev/null -delete

echo "✅ Done."
