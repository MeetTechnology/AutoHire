## ADDED Requirements

### Requirement: Incomplete detailed review results hide unproduced fields

The system SHALL show only detailed review fields backed by produced secondary analysis output while the detailed review run has not completed all prompts, and SHALL defer unproduced missing fields until all prompts complete.

#### Scenario: Partial prompt output is available

- **WHEN** the detailed review run has a total prompt count greater than zero and fewer completed prompts than total prompts
- **AND** at least one completed prompt has produced detailed review field values
- **THEN** the detailed review result SHALL render fields with non-empty produced source values
- **AND** the detailed review result SHALL NOT render empty fields as missing solely because their prompts have not completed yet

#### Scenario: No prompt output is available yet

- **WHEN** the detailed review run has started but no completed prompt has produced detailed review field values
- **THEN** the detailed review result SHALL keep the existing preparing message
- **AND** the detailed review result SHALL NOT render the full detailed review field set as missing

#### Scenario: All prompts are complete

- **WHEN** the detailed review run has completed prompts greater than or equal to its total prompt count
- **THEN** the detailed review result SHALL render the full editable detailed review field set
- **AND** fields without produced values SHALL be visible as missing fields
