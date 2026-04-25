## MODIFIED Requirements

### Requirement: Initial CV review extract uses table presentation
The system SHALL render the initial CV review extract as a semantic table wherever extracted initial CV review fields are presented to the applicant, including the active confirmation step on `/apply/resume` and post-judgment review surfaces, with each configured extract field shown as a row containing the field label and its display value.

#### Scenario: Initial CV extract data is available for confirmation
- **WHEN** the application has extracted initial CV review fields available and eligibility judgment has not yet started
- **THEN** `/apply/resume` SHALL render a table with one row per configured field in the existing display order
- **AND** each row SHALL show a field label cell and a corresponding value cell
- **AND** the table SHALL be presented as part of the applicant confirmation step

#### Scenario: Initial CV extract data is available after judgment
- **WHEN** the application has extracted initial CV review fields available for post-judgment review
- **THEN** the page SHALL render a table with one row per configured field in the existing display order
- **AND** each row SHALL show a field label cell and a corresponding value cell

#### Scenario: Display values are normalized through existing helpers
- **WHEN** the table renders field values
- **THEN** each value SHALL come from the existing extract value normalization logic used by the review page
- **AND** the table conversion SHALL NOT introduce alternative mapping rules for the same fields
