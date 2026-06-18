## ADDED Requirements

### Requirement: Public demo widget at /demo/demobeauty
The system SHALL serve a public chatbot demo at `/demo/demobeauty` using the existing `DemoWidgetPage` component with `chatbotId=demobeauty`.

#### Scenario: Demo widget loads
- **WHEN** a visitor navigates to /demo/demobeauty
- **THEN** the ChatWidget renders branded as Demobeauty and connects to the custom-demobeauty chatbot module
