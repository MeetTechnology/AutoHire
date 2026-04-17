## MODIFIED Requirements

### Requirement: Detailed review progress appears above the review section
The system SHALL present detailed-review status and prompt completion summary above the applicant-facing "Detailed review" section on `/apply/result`, SHALL NOT render the low-priority "Technical details" diagnostics disclosure for this workflow, and SHALL NOT render the sentence "No detailed review fields are currently available for this application state." in the pre-start state.

#### Scenario: Detailed review is in progress
- **WHEN** the application has a detailed-review run that has started but has not completed all prompts
- **THEN** the result page SHALL show the current detailed-review status above the "Detailed review" section
- **AND** the page SHALL show prompt completion as a compact `x/9` progress value without the label "Completed prompts"
- **AND** the bottom diagnostics disclosure titled "Technical details" SHALL NOT be present

#### Scenario: Detailed review has not started yet
- **WHEN** the application is on `/apply/result` and detailed-review fields are not available yet
- **THEN** the page SHALL NOT render the sentence "No detailed review fields are currently available for this application state."
- **AND** the page SHALL keep existing start guidance and status context without introducing replacement empty-state text
