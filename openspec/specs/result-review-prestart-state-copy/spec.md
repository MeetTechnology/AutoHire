# result-review-prestart-state-copy

## Purpose

Defines applicant-facing copy requirements for the pre-start detailed review state on `/apply/result`.

## Requirements

### Requirement: Pre-start detailed review state omits redundant empty-state copy

The system SHALL NOT display the sentence "No detailed review fields are currently available for this application state." on `/apply/result` before detailed review fields become available, and SHALL rely on existing status banners and section context to communicate progress.

#### Scenario: Applicant is eligible and detailed review has not started

- **WHEN** application status is `ELIGIBLE` and no detailed review fields are available yet
- **THEN** the page SHALL NOT render the sentence "No detailed review fields are currently available for this application state."
- **AND** the page SHALL continue to show existing guidance for starting detailed review

#### Scenario: Detailed review starts after the pre-start state

- **WHEN** application transitions from `ELIGIBLE` to a detailed review status such as `SECONDARY_ANALYZING` or `SECONDARY_REVIEW`
- **THEN** the page SHALL render the status-driven detailed review content defined for that state
- **AND** no removed pre-start empty-state sentence SHALL reappear during the transition
