## MODIFIED Requirements

### Requirement: Initial CV review extract uses table presentation
The system SHALL render the "Initial CV review extract" section as a semantic table on the applicant CV review page, with each configured extract field shown as a row containing the field label and its display value.

#### Scenario: Initial CV extract data is available
- **WHEN** the application has extracted initial CV review fields available for display
- **THEN** the page SHALL render a table with one row per configured field in the existing display order
- **AND** the configured rows SHALL include `Name`, `Personal Email`, `Phone Number`, `Year of Birth`, `Doctoral Degree Status`, `Doctoral Graduation Time`, `Current Title Equivalence`, `Current Job Country`, `Work Experience (2020–present)`, and `Research Area`
- **AND** each row SHALL show a field label cell and a corresponding value cell

#### Scenario: Display values are normalized through existing helpers
- **WHEN** the table renders field values
- **THEN** each value SHALL come from the normalized extract display logic used by the CV review page
- **AND** blank contact-field values MAY be filled from stored application-level contact values when the latest analysis result still omits them
- **AND** fields with no available extracted or stored value SHALL render the existing empty-state display value
