# 008-channel-wizard

## Goal
Create a polished "Channel Creation Wizard" for UI/UX excellence, replacing the simple settings form for new channels.

## UX Flow
**Step 1: Introduction**
- "Connect your WhatsApp Number"
- Explain requirements: Phone nearby, ready to scan.

**Step 2: Configuration**
- Input: Phone Number (with Country Code validation).
- Input: Display Name.
- Action: "Generate QR Code".
- System: Calls backend to create instance.

**Step 3: Scan QR**
- Show QR Code (via polling from task 006).
- Instructions: "Open WhatsApp > Settings > Linked Devices > Link a Device".
- Status indicator: "Waiting for scan...".

**Step 4: Success**
- Big green checkmark.
- "Channel Ready!".
- Redirect to Settings/Dashboard.

## Components
- `ChannelWizardDialog` or `ChannelWizardPage`.
- Stepper component (`1. Info`, `2. Scan`, `3. Done`).

## Acceptance Criteria
1. Multi-step wizard UI implemented.
2. Validation at each step.
3. Phone number formatting enforcement (e.g., using `react-phone-number-input`).
4. Smooth transitions between steps.
