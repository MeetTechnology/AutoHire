## ADDED Requirements

### Requirement: Applicant flow uses a unified CV Review step

The system SHALL present the applicant journey as four visible steps: Project Introduction, CV Review, Additional Information, and Submission Complete.

#### Scenario: Flow stepper is shown

- **WHEN** an applicant views any apply-flow page
- **THEN** the stepper SHALL show Project Introduction, CV Review, Additional Information, and Submission Complete as the complete visible journey
- **AND** the stepper SHALL NOT show separate Upload CV and CV Review steps

#### Scenario: Applicant reaches CV Review after introduction

- **WHEN** an applicant completes or resumes after the Project Introduction step
- **THEN** the system SHALL route the applicant to the unified CV Review step
- **AND** the CV Review step SHALL support both initial CV upload and review outcome states

### Requirement: CV Review upload removes identity and draft fields

The system SHALL allow applicants to upload a CV from the unified CV Review step without entering Passport Full Name or Email fields.

#### Scenario: Initial CV Review upload state is rendered

- **WHEN** an applicant can upload a CV
- **THEN** the CV Review page SHALL show the CV file selection and submit controls
- **AND** the page SHALL NOT show Passport Full Name or Email inputs
- **AND** the page SHALL NOT show the copy "Draft saves automatically"
- **AND** the page SHALL NOT show the copy "Typed values will be cached locally after a short pause."

#### Scenario: Resume upload is confirmed without applicant-entered identity

- **WHEN** an applicant submits a valid CV file from the unified CV Review step
- **THEN** the system SHALL confirm the resume upload without requiring Passport Full Name or Email values from the applicant-facing form
- **AND** the system SHALL start initial CV analysis after successful upload confirmation

### Requirement: CV Review transitions from upload action to progress in place

The system SHALL replace the CV upload action area with the CV review progress card after a submitted CV starts analysis.

#### Scenario: Applicant submits a CV

- **WHEN** an applicant selects a valid CV file and submits it
- **THEN** the unified CV Review page SHALL remain on the CV Review route
- **AND** the upload action area SHALL transition into the CV review progress card
- **AND** the applicant SHALL NOT be sent through a visible navigation from Upload CV to a separate CV Review page

#### Scenario: CV analysis is running

- **WHEN** the application status is `CV_ANALYZING` or `REANALYZING`
- **THEN** the unified CV Review page SHALL show the same progress-card behavior used for CV review analysis
- **AND** the progress state SHALL continue refreshing until the analysis reaches a terminal or actionable state

### Requirement: CV Review transitions from progress to outcome in place

The system SHALL replace the CV review progress card with the CV review outcome content when analysis completes.

#### Scenario: Analysis completes with eligible outcome

- **WHEN** CV analysis completes with an eligible result
- **THEN** the unified CV Review page SHALL replace the progress card with the initial CV review extract and eligible outcome content
- **AND** the page SHALL provide the existing path toward Additional Information or supporting materials

#### Scenario: Analysis completes with ineligible outcome

- **WHEN** CV analysis completes with an ineligible result
- **THEN** the unified CV Review page SHALL replace the progress card with the existing ineligible CV review outcome content

#### Scenario: Analysis requires additional information

- **WHEN** CV analysis completes with missing required information
- **THEN** the unified CV Review page SHALL replace the progress card with the existing CV review outcome context
- **AND** the page SHALL provide the supplemental-field form needed to rerun CV review

### Requirement: Compatibility route preserves old CV Review links

The system SHALL keep old CV Review route access functional during the merge.

#### Scenario: Applicant opens the old CV Review route

- **WHEN** an applicant opens `/apply/result` with a valid application session
- **THEN** the system SHALL route or render the applicant into the unified CV Review experience
- **AND** the applicant SHALL NOT encounter a broken page solely because the old CV Review route was used
