## ADDED Requirements

### Requirement: Welcome and sede selection
The bot SHALL greet the customer on the first turn (greeting + presentation video + privacy notice) and ask which sede they want to interact with before any other question — same welcome pattern as the other chatbots.

#### Scenario: First message triggers welcome
- **WHEN** a customer sends their first message
- **THEN** the bot replies with a welcome greeting, the presentation video link (https://www.youtube.com/watch?v=axcae7wEaiE), the privacy notice, lists the available sedes (Navigli, Isola, Monza), and asks which one the customer is interested in

#### Scenario: Customer mentions a sede in the first message
- **WHEN** the customer mentions a sede name (e.g. "Navigli") in their first message
- **THEN** the bot welcomes them and confirms the selected sede without re-asking

### Requirement: Per-sede service catalog
The bot SHALL only present services available at the customer's selected sede. Services not offered at a sede MUST NOT be listed or priced for that sede.

#### Scenario: Customer asks for a service not at their sede
- **WHEN** the customer asks about epilazione laser and their sede is Monza (which does not offer it)
- **THEN** the bot informs them laser is not available at Monza and offers the nearest sede that has it (Navigli) or an alternative service at Monza

#### Scenario: Per-sede pricing
- **WHEN** the customer asks the price of a service
- **THEN** the bot replies with the price specific to the selected sede, never a generic or average price

### Requirement: Multi-service booking with duration calculation
The bot SHALL support booking multiple services in one appointment and calculate the combined duration and end time.

#### Scenario: Customer books two services
- **WHEN** the customer wants pulizia viso (50 min) and manicure classica (30 min) at 17:30
- **THEN** the bot confirms total duration is 80 min and end time is 18:50

#### Scenario: Upsell changes duration and price
- **WHEN** the customer upgrades from manicure classica to semipermanente (+15 min, +15€)
- **THEN** the bot updates the total duration, end time, and total price in the confirmation

### Requirement: In-memory cart
The bot SHALL maintain a cart in SessionState accumulating services and products. The cart SHALL be cleared after a successful booking.

#### Scenario: Cart accumulates across turns
- **WHEN** the customer adds a service and then adds a product in separate messages
- **THEN** both items appear in the booking summary with individual prices and a total

#### Scenario: Cart cleared on booking
- **WHEN** the booking is confirmed and the calendar event is created
- **THEN** the cart is set to null in SessionState

### Requirement: Slot availability enforcement
The bot SHALL only offer slots that are not already booked. It SHALL never confirm a slot that is occupied.

#### Scenario: Requested slot is taken
- **WHEN** the customer requests a time slot that is already booked
- **THEN** the bot informs them that slot is unavailable and offers the next available alternatives

### Requirement: Booking data collection
Before confirming a booking the bot SHALL collect: name, phone number, and email address.

#### Scenario: Bot collects missing contact data
- **WHEN** the customer confirms a slot but has not yet provided name, phone, or email
- **THEN** the bot asks for the missing fields before finalising the booking

#### Scenario: Email captured automatically
- **WHEN** the customer writes their email address anywhere in the conversation
- **THEN** the PII pre-scan captures it automatically and the bot does not ask again

### Requirement: Booking confirmation email
After a successful booking the bot SHALL send a confirmation email to the customer with: sede, date, time, services, products to pick up, and total.

#### Scenario: Confirmation email sent
- **WHEN** booking is confirmed
- **THEN** a confirmation email is sent to the customer's email address with full appointment details

### Requirement: Google Calendar event creation
On booking, the bot SHALL create a calendar event in the SINGLE franchise Google Calendar, tagged by sede, containing: customer name, phone, email, services, products, specialist assigned, and total.

#### Scenario: Calendar event created with full data
- **WHEN** a booking is confirmed
- **THEN** a Google Calendar event is created in the franchise calendar, tagged with [SEDE][CATEGORIA], containing all booking and cart details

### Requirement: Product catalog and cart
The bot SHALL present the product catalog (shared network-wide — same products and prices at every sede) and allow the customer to add products to the cart. Services, prices, hours and specialists are per-sede; the product catalog is identical across all sedes.

#### Scenario: Customer adds product to cart
- **WHEN** the customer says they want to buy the Siero Acido Ialuronico
- **THEN** the product is added to the cart and the updated total is shown

#### Scenario: Products included in calendar event
- **WHEN** booking is confirmed and cart has products
- **THEN** the calendar event description lists the products to prepare for pickup

### Requirement: Push notification simulation
The bot SHALL be able to send unsolicited push messages simulating: new product announcements, new service announcements, new sede openings, and appointment reminders.

#### Scenario: Appointment reminder push
- **WHEN** a push is triggered for an upcoming appointment
- **THEN** the customer receives a message with sede, date, time, and services booked

### Requirement: Operator escalation and chatbot deactivation
The bot SHALL escalate to a human operator when: the customer explicitly requests it, there is a payment dispute or payment request, or a complaint cannot be resolved by the bot. On escalation the bot SHALL return `shouldEscalate: true` so the host disables the chatbot for that customer (sets `activeChatbot = false`), routing subsequent messages to the operator instead of the LLM.

#### Scenario: Customer requests human operator
- **WHEN** the customer says they want to speak with a person
- **THEN** the bot calls escalate_to_operator with reason and structured briefing, informs the customer that an operator will follow up, and returns shouldEscalate=true

#### Scenario: Chatbot disabled after handoff
- **WHEN** the bot returns shouldEscalate=true
- **THEN** the host sets activeChatbot=false for that customer and subsequent customer messages go to the operator, not the bot

#### Scenario: Payment request escalates
- **WHEN** the customer asks to make a payment or disputes a charge
- **THEN** the bot escalates to an operator rather than handling the payment itself

### Requirement: Multilingual responses
The bot SHALL detect the customer's language and reply in that language, supporting every language Claude handles (not a fixed list), exactly like the other custom chatbots. Data values (sede names, service names) are copied verbatim; all sentences and labels are written in the customer's language.

#### Scenario: Customer writes in another language
- **WHEN** the customer writes in English (or any supported language)
- **THEN** the bot replies in that same language while keeping Italian data values (sede/service names) as data

### Requirement: Audio reciprocity
The bot SHALL mirror the input modality: reply with text when the customer sends text, and reply with audio when the customer sends audio, using the per-language voice configured in settings.json — exactly like the other custom chatbots.

#### Scenario: Customer sends audio
- **WHEN** the customer sends a voice message
- **THEN** the bot's reply is delivered as audio in the customer's language

#### Scenario: Customer sends text
- **WHEN** the customer sends a text message
- **THEN** the bot replies with text

### Requirement: Media handling (photos, audio, documents)
The bot SHALL support receiving and sending photos, audio messages and PDF documents, like the other chatbots. Photos and documents that require professional judgement or manual handling SHALL be routed to an in-sede check-up or to an operator.

#### Scenario: Customer sends a photo
- **WHEN** the customer sends a photo (e.g. a nail or skin area)
- **THEN** the bot acknowledges it and, if a professional assessment is needed, proposes an in-sede check-up or escalates to an operator

#### Scenario: Customer sends a PDF
- **WHEN** the customer sends a PDF document that needs manual handling
- **THEN** the bot routes it to an operator

### Requirement: Cross-sede routing
The bot SHALL inform the customer when a requested service is not available at their sede and suggest the nearest sede that offers it.

#### Scenario: Service available at another sede
- **WHEN** customer at Monza asks for epilazione laser (not available at Monza)
- **THEN** the bot says laser is not available at Monza but is offered at Navigli (~12 km), and asks if the customer wants to be redirected
