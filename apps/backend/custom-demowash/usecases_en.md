## Index

DemoWash is a self-service laundromat franchise with 6 locations in Catalonia: **Eixample**, **Gràcia**, **Mataró**, **Rubí**, **Sant Cugat** and **Terrassa**.

Each location has its own opening hours, machines, programs, prices and accepted payment methods. Before giving any operational data, the chatbot always identifies which location the customer is at. For technical issues it asks the 4 data points one at a time: **location → type → number → display**.

### The machine has a problem
- [OPEN message on the display (door not fully closed)](#open-message)
- [ERR-01 message on the display (program selected before payment)](#err-01-message)
- [ALERT or BLOCK message (technical fault)](#alert-or-block-message)
- [The washer doesn't start after payment (display off)](#doesnt-start-after-payment)
- [The door doesn't unlock at end of cycle](#door-doesnt-unlock)
- [The dryer doesn't heat](#dryer-doesnt-heat)

### Payments and refunds
- [Double charge on card](#double-charge)
- [I paid but the machine didn't start](#paid-without-activation)
- [Dryer coins don't add up](#dryer-coins-dont-add-up)
- [Clothes came out badly washed (dirty, still wet, bad smell)](#badly-washed-clothes)
- [I'd like an invoice](#invoice)

### Washing tips (universal FAQ)
- [What temperature should I wash a stained white shirt at?](#stained-white-shirt)
- [What temperature should I wash colored clothes at?](#colored-clothes-temperature)
- [I have a grease stain, how do I remove it?](#grease-stain)
- [Do I have to bring detergent?](#detergent-included)
- [Can I wash duvets and blankets?](#duvets-and-blankets)
- [How long does a wash take?](#wash-duration)

### Location data (franchising)
- [What are the opening hours?](#opening-hours)
- [How much does a wash cost?](#prices)
- [Can I pay with a card?](#payment-methods)
- [What programs does the washer have?](#programs)
- [How does the loyalty card work?](#loyalty-card)
- [How much do I save with the loyalty card?](#loyalty-card-savings)
- [Where's the nearest laundromat?](#nearest-laundromat)

---

## OPEN message

> Technical issue — flow location → type → number → display (1 data point per turn).

**Customer:** My washer won't start.
**Bot:** Hi! 👋 I'm the **Demowash** virtual assistant. Which laundromat are you at?

**Customer:** Eixample.
**Bot:** Washer or dryer?

**Customer:** Washer.
**Bot:** What's the machine number?

**Customer:** Number 3.
**Bot:** What do you see on the screen?

**Customer:** OPEN.
**Bot:** Open the door carefully, check if any clothing is caught in the seal, and close it firmly again until you hear the click. Has the message gone?

**Customer:** Yes, it's gone.
**Bot:** Perfect. Select the program again. Happy washing! 👋

---

## ERR-01 message

**Customer:** I'm at Mataró, washer 6 with ERR-01.
**Bot:** You pressed the program before paying. Let's restart:

1. Load the clothes and close the door properly.
2. Go to the payment terminal, pay and select your machine number.
3. Go back to the machine and press the program.

Tell me if it starts.

**Customer:** Yes, now it starts.
**Bot:** Perfect! Happy washing 👋

---

## ALERT or BLOCK message

**Customer:** Sant Cugat, washer 4, shows ALERT.
**Bot:** The machine detected an issue and needs servicing. Please move your clothes to a free washer and tell me which one you chose. We'll activate it remotely so you can wash at no extra cost.

**Customer:** I'm now at washer 2.
**Bot:** Thanks. What's your name? I'll forward the case to an operator to activate washer 2 and log the issue on washer 4.

**Customer:** Andrea.
**Bot:** I've logged your case, Andrea. An operator will contact you within a few minutes.

---

## Doesn't start after payment

> Special case: the display is off or shows no code — the bot escalates directly because without a code there's no documented procedure.

**Customer:** I paid but the machine isn't starting.
**Bot:** Which laundromat are you at?

**Customer:** Rubí.
**Bot:** Washer or dryer?

**Customer:** Washer.
**Bot:** What's the machine number?

**Customer:** Number 3.
**Bot:** What do you see on the screen?

**Customer:** Nothing, it's off.
**Bot:** Got it. What's your name? I'll forward the case to an operator to activate the machine remotely.

**Customer:** Marta.
**Bot:** I've logged your case, Marta. An operator will contact you within a few minutes.

---

## Door doesn't unlock

**Customer:** The door won't open, the wash already finished.
**Bot:** Don't worry. When the cycle ends, the door takes a few minutes to unlock. How long ago did the wash finish?

**Customer:** Over 5 minutes ago.
**Bot:** Which laundromat are you at?

**Customer:** Gràcia.
**Bot:** What's the washer number?

**Customer:** Number 2.
**Bot:** What's your name? I'll forward the case to an operator to unlock the door remotely.

**Customer:** Luis.
**Bot:** I've logged your case, Luis. An operator will contact you within a few minutes.

---

## Dryer doesn't heat

**Customer:** The dryer isn't heating, the minutes run down but the clothes stay wet.
**Bot:** I'm sorry. Which laundromat are you at?

**Customer:** Terrassa.
**Bot:** What's the dryer number?

**Customer:** Number 5.
**Bot:** What's your name? I'll forward the case to an operator to refund the cycle and check the machine.

**Customer:** Anna.
**Bot:** I've logged your case, Anna. An operator will contact you within a few minutes.

---

## Double charge

**Customer:** You charged me twice on the card.
**Bot:** I'm sorry. Which laundromat are you at?

**Customer:** Eixample.
**Bot:** What's the machine number?

**Customer:** Number 1.
**Bot:** Could you give me the last 4 digits of the card and your name? I'll forward the case to an operator to verify the double charge.

**Customer:** Card 8821, I'm Jordi.
**Bot:** I've logged your case, Jordi. An operator will contact you within a few minutes.

---

## Paid without activation

**Customer:** I paid but the machine didn't start and I want a refund.
**Bot:** I'm sorry. Which laundromat are you at?

**Customer:** Mataró.
**Bot:** Washer or dryer?

**Customer:** Washer, number 6.
**Bot:** How did you pay: cash, loyalty card or bank card?

**Customer:** Bank card, ending in 4412.
**Bot:** What's your name?

**Customer:** Carla.
**Bot:** I've logged your case, Carla. An operator will contact you within a few minutes to process the refund.

---

## Dryer coins don't add up

**Customer:** I put coins in the dryer but the minutes don't go up.
**Bot:** I'm sorry. Which laundromat are you at?

**Customer:** Rubí.
**Bot:** What's the dryer number?

**Customer:** Number 3.
**Bot:** What's your name? I'll forward the case to an operator to refund the money and check the machine.

**Customer:** Mireia.
**Bot:** I've logged your case, Mireia. An operator will contact you within a few minutes.

---

## Badly washed clothes

> The customer reports a defective service outcome (clothes still dirty after the cycle, still wet after a full drying cycle, bad smell). The bot treats this as a quality incident, collects location + machine type + number + name, and forwards the case to an operator to assess the refund. The bot **does not decide** the refund — that's up to the operator.

**Customer:** The clothes came out dirty and smell bad after the wash — I want a refund.
**Bot:** I'm sorry. Which laundromat are you at?

**Customer:** Eixample.
**Bot:** Washer or dryer?

**Customer:** Washer, number 3.
**Bot:** What's your name?

**Customer:** Marta.
**Bot:** I've logged your case, Marta. An operator will contact you within a few minutes to review the case and the refund.

---

## Invoice

> The bot asks for each piece of data one at a time ("one question per turn" rule): business name → amount → service date → email → optional note.
>
> 🔒 **Sensitive data kept out of the LLM flow**: business name, tax ID, address, email and other personal details are NOT sent to the AI model (OpenAI/OpenRouter). The bot collects each field and our code processes it deterministically — the replies on these turns are **hard-wired in code**, not generated by the LLM. This way PII data stays out of the standard flow toward the AI.

**Customer:** I'd like an invoice for the wash.
**Bot:** Great! I'll prepare the invoice for you. What's the company name or legal name?

**Customer:** Marta Ribas Ltd.
**Bot:** Thanks. What's the amount you paid? (in euros)

**Customer:** €8.
**Bot:** Got it. When did you use the service? (e.g. today, yesterday, 29/05/2026)

**Customer:** Today.
**Bot:** Understood. What email should I send the invoice to?

**Customer:** marta@example.com
**Bot:** Thanks. Want to add a note? (e.g. tax ID, customer code, reference) If not, type "no".

**Customer:** Tax ID B12345678.
**Bot:** Perfect. I've registered the invoice with the details: Marta Ribas Ltd., €8, today, Tax ID B12345678. You'll get it at marta@example.com in a few minutes.

---

## Stained white shirt

> Universal FAQ — does not depend on location.

**Customer:** I have a stained white shirt — what temperature can I wash it at without ruining it?
**Bot:** For a stained white shirt:
- **Sturdy cotton**: **40°C** (up to 60°C for stubborn stains)
- **Delicate fabrics** (silk, wool, fine blends): **30°C**

Above 40°C on delicate fabrics you risk setting the stain. Pick the matching program on the machine's display — detergent is dosed automatically.

---

## Colored clothes temperature

**Customer:** What temperature should I wash colored clothes at?
**Bot:** Rule of thumb for colored clothes:
- **Dark colors / blacks**: **30°C** (prevents color fading)
- **Light colors**: **30-40°C**
- **Tough colors with stains**: up to **40°C**

Never wash colored clothes above 40°C the first time — colors bleed most when fabric is new.

---

## Grease stain

**Customer:** I have a grease stain on a shirt, how do I remove it?
**Bot:** First, blot the excess with kitchen paper without rubbing (rubbing spreads the stain). Then select:
- **Cotton**: **60°C**
- **Synthetics or delicates**: **40°C**

Demowash detergent contains a degreasing agent that's dosed automatically.

---

## Detergent included

**Customer:** Do I have to bring detergent?
**Bot:** No, you don't need to bring anything! Demowash machines **automatically dose** certified eco-friendly detergent and softener made with 100% natural ingredients. Just bring your clothes. 😊

---

## Duvets and blankets

**Customer:** Can I wash duvets and blankets?
**Bot:** Yes, you can! Here are the tips:

**Duvets and blankets in cotton or sturdy polyester:**
- **Temperature**: **40°C**
- **Capacity**: use a **20 kg** washer for big duvets
- **After the wash**: dryer at **high or medium heat** to remove moisture properly

**Delicate duvets or with synthetic filling:**
- **Temperature**: **30°C**

**Tips**:
- Don't overload the machine — the duvet needs room to move
- After the wash the duvet will be very wet: put it through the **dryer** to finish

If you want to know which large machines are available and the exact prices, tell me which laundromat you're at. 😊

---

## Wash duration

**Customer:** How long does a wash take?
**Bot:** Duration depends on the **program** you pick:

- **60°C** (very hot): **50-55 minutes**
- **40°C** (hot): **45-50 minutes**
- **30°C** (warm): **40-45 minutes**
- **Cold** (*): **35-40 minutes**

These are rough times. During the cycle the screen shows a countdown of the time left (e.g. `T-28` means 28 minutes). 😊

---

## Opening hours

> Per-location FAQ — the bot only asks for the location.

**Customer:** What are the opening hours?
**Bot:** Which laundromat are you at?

**Customer:** Gràcia.
**Bot:** At **Gràcia** we're open from **7:00 to 23:00**, every day.

---

## Prices

**Customer:** How much does a wash cost?
**Bot:** Which laundromat are you at?

**Customer:** Eixample.
**Bot:** At **Eixample** these are the washer prices:

| Num. | Weight | Loyalty | Cash   |
|------|--------|---------|--------|
| 1    | 20 kg  | €7      | €8     |
| 2    | 20 kg  | €7      | €8     |
| 3    | 10 kg  | €4      | €4.50  |
| 4    | 10 kg  | €4      | €4.50  |

Want the dryer prices too?

---

## Payment methods

**Customer:** Can I pay with a card?
**Bot:** Which laundromat are you at?

**Customer:** Gràcia.
**Bot:** At **Gràcia** only **credit/debit card** is accepted. No cash or loyalty card at this location.

---

## Programs

**Customer:** What programs does the washer have?
**Bot:** Which laundromat are you at?

**Customer:** Eixample.
**Bot:** At **Eixample** the washer has 4 programs:

| Button | Program  | Temperature |
|--------|----------|-------------|
| 1      | Very hot | 60°         |
| 2      | Hot      | 40°         |
| 3      | Warm     | 30°         |
| 4      | Cold     | *           |

The dryer has 3: high, medium and low heat.

---

## Loyalty card

> The bot confirms whether the customer's location accepts the card and shows the reduced prices. For activation, top-up or balance checks it redirects to the laundromat team — they handle the card on-site. The bot frames this as a service of the location, not as a limitation of its own.

**Customer:** How does the loyalty card work?
**Bot:** With the loyalty card you pay **less** than with cash or bank card — the discount applies automatically on every wash and dry.

Which laundromat are you at? I'll confirm whether we accept it there and give you the prices.

**Customer:** Eixample.
**Bot:** At **Eixample** yes, we accept the loyalty card. These are the prices:

| Machine         | Capacity | Loyalty |
|-----------------|----------|---------|
| Washer 1-2      | 20 kg    | €7      |
| Washer 3-4      | 10 kg    | €4      |
| Dryer 5-6       | 20 kg    | €2.50   |

---

## Loyalty card savings

> The bot needs the location to show the exact savings — every site has different prices.

**Customer:** How much do I save with the loyalty card?
**Bot:** To tell you the exact savings, which laundromat are you at?

**Customer:** Rubí.
**Bot:** At **Rubí** the savings with the loyalty card are:

**Washers**:
- Machine 1 (10 kg): **€0.50 savings** (€4.50 with card vs €5 cash)
- Machine 2 (15 kg): **€1 savings** (€6 with card vs €7 cash)
- Machine 3 (20 kg): **€1 savings** (€7 with card vs €8 cash)

**Dryers** (machines 4 and 5, 20 kg): **same price** with card or cash (€2 / 15 min).

💡 If you regularly use the big washer (machine 3), the card pays for itself in a few uses. 😊

---

## Nearest laundromat

**Customer:** Where's the nearest laundromat?
**Bot:** What area are you in? I'll give you the details for the most convenient one.

**Customer:** I'm in Barcelona.
**Bot:** In Barcelona we have two Demowash locations:

1. **Eixample** — C/ Aragó 286, near Passeig de Gràcia. Hours: 8:00 — 22:00
2. **Gràcia** — C/ Verdi 47, near Plaça del Sol. Hours: 7:00 — 23:00

Which one are you at, or which one are you interested in? 😊

---
