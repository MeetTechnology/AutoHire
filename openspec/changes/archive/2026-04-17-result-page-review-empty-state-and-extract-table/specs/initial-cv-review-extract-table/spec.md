## ADDED Requirements

### Requirement: Initial CV review extract uses table presentation
The system SHALL render the "Initial CV review extract" section as a semantic table on `/apply/result`, with each configured extract field shown as a row containing the field label and its display value.

#### Scenario: Initial CV extract data is available
- **WHEN** the application has extracted initial CV review fields available for display
- **THEN** the page SHALL render a table with one row per configured field in the existing display order
- **AND** each row SHALL show a field label cell and a corresponding value cell

#### Scenario: Display values are normalized through existing helpers
- **WHEN** the table renders field values
- **THEN** each value SHALL come from the existing extract value normalization logic used by the review page
- **AND** the table conversion SHALL NOT introduce alternative mapping rules for the same fields
