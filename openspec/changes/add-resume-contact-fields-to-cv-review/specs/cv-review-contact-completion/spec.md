## ADDED Requirements

### Requirement: Application stores CV review contact completion fields
The system SHALL persist application-level screening contact values for `Name`, `Personal Email`, and `Phone Number` whenever those values are supplied through CV review confirmation or CV review follow-up completion.

#### Scenario: Applicant supplies missing contact fields on the CV review follow-up form
- **WHEN** an applicant submits one or more of the contact fields from the CV review follow-up form
- **THEN** the corresponding `Application` record SHALL store the normalized values for name, personal email, and phone number that were supplied

#### Scenario: Reanalysis still omits contact fields after applicant completion
- **WHEN** an applicant previously supplied one or more contact fields and a later CV review result still returns those contact fields as blank or `!!!null!!!`
- **THEN** the review snapshot SHALL use the stored application-level contact values as fallback display values for those contact fields

### Requirement: Eligible applicants must complete missing contact fields before entering materials
The system SHALL require completion of missing contact fields before an otherwise eligible applicant can continue from CV review to Additional Information / supporting materials.

#### Scenario: Eligible result is missing one or more contact fields
- **WHEN** the initial CV review result is eligible and one or more of `Name`, `Personal Email`, or `Phone Number` is missing after considering stored application-level contact values
- **THEN** the application SHALL remain on the CV review experience in an action-required state
- **AND** the page SHALL prompt the applicant to fill the missing contact fields before continuing
- **AND** the system SHALL NOT enter the supporting-materials stage yet

#### Scenario: Eligible result has complete contact fields
- **WHEN** the initial CV review result is eligible and all required contact fields are available from extraction or stored application-level values
- **THEN** the applicant SHALL be allowed to continue to the supporting-materials stage without an extra contact-completion prompt

### Requirement: Contact-field completion does not change ineligible handling
The system SHALL NOT require contact-field completion when the CV review outcome is ineligible.

#### Scenario: Ineligible result is missing contact fields
- **WHEN** the CV review result is ineligible and one or more contact fields is missing
- **THEN** the page SHALL continue showing the ineligible outcome content
- **AND** the page SHALL NOT require the applicant to fill the missing contact fields to finish the review step

### Requirement: Contact-field completion joins existing reanalysis flow only when critical information is also missing
The system SHALL combine missing contact fields with the existing supplemental-information flow when the CV review result still lacks critical eligibility information.

#### Scenario: Insufficient-info result has critical missing fields but no contact gaps
- **WHEN** the CV review result requires additional eligibility information and the contact fields are already complete
- **THEN** the page SHALL continue showing the existing supplemental-information flow without adding extra contact prompts

#### Scenario: Insufficient-info result has both critical and contact missing fields
- **WHEN** the CV review result requires additional eligibility information and one or more contact fields is also missing
- **THEN** the page SHALL show a single follow-up form containing both the critical missing fields and the missing contact fields
- **AND** submitting that form SHALL persist the contact values and trigger CV review reanalysis
