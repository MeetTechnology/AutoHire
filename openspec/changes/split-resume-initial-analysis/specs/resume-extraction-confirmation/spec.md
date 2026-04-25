## ADDED Requirements

### Requirement: Initial resume review starts with extraction-only processing
The system SHALL start the initial resume review by submitting the uploaded CV to the extraction-only resume-process flow and SHALL NOT run eligibility judgment until the applicant confirms the extracted information.

#### Scenario: Applicant starts review after uploading a CV
- **WHEN** an applicant with a saved CV starts CV review on `/apply/resume`
- **THEN** the system SHALL create an extraction-only upstream job using the split initial resume-process API
- **AND** the application SHALL enter an extraction-in-progress state
- **AND** the system SHALL NOT create a final eligibility result for the application at this stage

#### Scenario: Extraction is processing
- **WHEN** the extraction-only upstream job is queued or processing
- **THEN** `/apply/resume` SHALL show extraction-specific progress copy
- **AND** the page SHALL continue polling the application analysis status until extraction completes or fails

#### Scenario: Extraction fails
- **WHEN** the extraction-only upstream job fails
- **THEN** the application SHALL show a failure message on `/apply/resume`
- **AND** the application SHALL NOT allow eligibility judgment to be triggered for that failed extraction job

### Requirement: Applicant confirms extracted information before eligibility judgment
The system SHALL present the extracted initial review fields for applicant confirmation and SHALL trigger eligibility judgment only after the applicant confirms the extracted information.

#### Scenario: Extraction completes successfully
- **WHEN** extraction completes and normalized extracted fields are available
- **THEN** `/apply/resume` SHALL show the extracted information to the applicant
- **AND** the application SHALL enter a confirmation-pending state
- **AND** the page SHALL show an action for confirming the extracted information
- **AND** the page SHALL NOT show the final eligibility determination before confirmation

#### Scenario: Applicant confirms extracted information
- **WHEN** the applicant confirms the extracted information
- **THEN** the system SHALL call the eligibility judgment endpoint for the same upstream job
- **AND** the application SHALL enter an eligibility-judgment-in-progress state
- **AND** `/apply/resume` SHALL show judgment-specific progress copy

#### Scenario: Confirmation page is refreshed
- **WHEN** the applicant reloads `/apply/resume` while extracted information is awaiting confirmation
- **THEN** the system SHALL restore the extracted information from persisted application data
- **AND** the applicant SHALL be able to confirm without re-uploading the CV

### Requirement: Extraction-only contact fields do not affect eligibility flow
The system SHALL treat Name, Personal Email, Work Email, and Phone Number as extraction-only contact fields that do not influence eligibility judgment, rejection logic, bypass logic, or borderline checks.

#### Scenario: Contact fields are missing from extraction
- **WHEN** extraction returns `!!!null!!!` or no value for Name, Personal Email, Work Email, or Phone Number
- **THEN** the system SHALL still allow the applicant to confirm extracted information
- **AND** the system SHALL NOT block eligibility judgment solely because those contact fields are missing

#### Scenario: Eligibility judgment completes
- **WHEN** the final eligibility judgment result is processed
- **THEN** the system SHALL continue to use the judgment output for eligibility result, missing critical information, and final determination
- **AND** missing Name, Personal Email, Work Email, or Phone Number SHALL NOT be treated as critical eligibility gaps

### Requirement: Final outcome is created only after eligibility judgment
The system SHALL create and display final initial-review outcomes only after the eligibility judgment stage completes.

#### Scenario: Eligibility judgment completes successfully
- **WHEN** the upstream eligibility judgment stage completes for a confirmed extraction job
- **THEN** the system SHALL normalize the final three-section judgment output
- **AND** the system SHALL create the final analysis result for the application
- **AND** the application SHALL move to the appropriate final status based on the judgment result

#### Scenario: Judgment returns insufficient information
- **WHEN** eligibility judgment cannot make a final determination because required non-contact critical information is missing
- **THEN** the application SHALL enter the existing additional-information-required flow
- **AND** the supplemental-field loop SHALL continue to work as it does for final initial-review results

#### Scenario: Judgment result is eligible
- **WHEN** eligibility judgment determines that the applicant meets the basic requirements
- **THEN** `/apply/resume` SHALL show the eligible outcome
- **AND** the applicant SHALL be able to continue to supporting materials

#### Scenario: Judgment result is ineligible
- **WHEN** eligibility judgment determines that the applicant does not meet the basic requirements
- **THEN** `/apply/resume` SHALL show the ineligible outcome and reason text
- **AND** the applicant SHALL NOT be advanced to supporting materials by the split initial flow

### Requirement: Downstream review waits for final judgment
The system SHALL NOT allow downstream secondary analysis or supporting-materials progression to rely on an extraction-only upstream completion.

#### Scenario: Extraction is complete but judgment has not run
- **WHEN** the upstream extraction job is completed but the applicant has not confirmed and eligibility judgment has not completed
- **THEN** the application SHALL remain on `/apply/resume`
- **AND** secondary analysis SHALL NOT be triggered from that extraction-only completion
- **AND** supporting-materials navigation SHALL remain unavailable for that application state

#### Scenario: Judgment has completed
- **WHEN** eligibility judgment has completed and the application has a final initial-review result
- **THEN** existing downstream behavior for secondary review and supporting materials SHALL apply according to the final application status
