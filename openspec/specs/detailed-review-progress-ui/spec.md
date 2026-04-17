# detailed-review-progress-ui

## Purpose

Defines applicant-facing requirements for the detailed review portion of `/apply/result`, including progress presentation, readiness timing, completion messaging, and valid interactive structure around the continue action.

## Requirements

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

### Requirement: Ready messaging waits for completed prompts

The system SHALL defer the green "Detailed review is ready" success state until all detailed-review prompts have completed.

#### Scenario: Not all prompts are complete

- **WHEN** the detailed-review run has fewer completed prompts than its total prompt count
- **THEN** the result page SHALL show in-progress status and compact progress above the "Detailed review" section
- **AND** the green success banner stating that the detailed review is ready SHALL NOT be shown yet

#### Scenario: All prompts are complete

- **WHEN** the detailed-review run has completed all prompts
- **THEN** the result page SHALL show the green success state indicating that the detailed review is ready
- **AND** the compact in-progress progress indicator SHALL no longer be shown

### Requirement: Started notice disappears after completion

The system SHALL hide the informational sentence "The detailed review has already been started for this application." after the detailed-review run has completed all prompts.

#### Scenario: Run exists and is still processing

- **WHEN** the application has a detailed-review run identifier and the run has not completed all prompts
- **THEN** the result page MAY show informational copy indicating that the detailed review has already been started

#### Scenario: Run has completed

- **WHEN** the detailed-review run has completed all prompts
- **THEN** the sentence "The detailed review has already been started for this application." SHALL NOT be visible anywhere on the page

### Requirement: Detailed review actions use valid interactive structure

The system SHALL render the detailed-review disclosure and continue action without nesting a button element inside another button element.

#### Scenario: Detailed review completion action is rendered

- **WHEN** the result page renders the continue action for moving from detailed review to supporting materials
- **THEN** the rendered HTML SHALL NOT contain a `<button>` descendant inside the disclosure trigger `<button>`
- **AND** the page SHALL not emit the browser warning that a button cannot be a descendant of a button for this action area
