# apply-result-screening

## Purpose

Defines applicant-facing behavior and copy for resume screening on the apply **result** journey: neutral screening vocabulary (no “AI review” branding), a visible wait/progress experience without staged eligibility narration, outcome-first messaging, optional expert-facing contact via `mailto`, and clear guidance toward supporting materials when the applicant may proceed.

## ADDED Requirements

### Requirement: Neutral screening vocabulary

Applicant-visible headings, step labels, and primary status text for the resume screening experience on `/apply/result` and the apply flow stepper SHALL describe the step using **screening** or **review** language and SHALL NOT include the substring `AI Review`, `AI review`, or `AI` immediately before `review` or `screening` (case-insensitive match for those phrases).

#### Scenario: Result page analyzing header avoids AI branding

- **WHEN** the applicant views `/apply/result` while `applicationStatus` is `CV_ANALYZING`, `REANALYZING`, or `SECONDARY_ANALYZING`
- **THEN** the primary analyzing panel title SHALL NOT contain the forbidden phrases above

#### Scenario: Flow stepper label avoids AI branding

- **WHEN** the applicant views any apply page that renders the canonical multi-step flow labels from application flow constants
- **THEN** the label for the screening step (the step after CV upload) SHALL NOT contain the forbidden phrases above

### Requirement: Non-narrative in-progress primary messaging

While `applicationStatus` is `CV_ANALYZING`, `REANALYZING`, or `SECONDARY_ANALYZING`, the primary English line shown in the analysis wait panel SHALL communicate only that **screening or processing is in progress** and SHALL NOT enumerate sequential eligibility checks, extracted attributes, or rule names (for example messages framed as confirming specific degrees, age thresholds, academic ranks, or “applying eligibility rules” as distinct timed stages).

#### Scenario: Primary line stays generic during initial analyzing

- **WHEN** `applicationStatus` is `CV_ANALYZING` or `REANALYZING` for at least sixty continuous seconds
- **THEN** every primary line rendered in the wait panel during that interval SHALL satisfy the non-narrative rule above

#### Scenario: Primary line stays generic during detailed analyzing

- **WHEN** `applicationStatus` is `SECONDARY_ANALYZING` for at least sixty continuous seconds
- **THEN** every primary line rendered in the wait panel during that interval SHALL satisfy the non-narrative rule above

### Requirement: Visible progress while analyzing

For `CV_ANALYZING`, `REANALYZING`, and `SECONDARY_ANALYZING`, the system SHALL render a **visible** determinate-style progress indicator (for example a filled track whose length reflects elapsed time with a pre-completion cap) together with the generic primary messaging, so applicants understand that processing continues and they should wait.

#### Scenario: Analyzing states show a progress bar

- **WHEN** `applicationStatus` is one of the three analyzing statuses above
- **THEN** the result view SHALL include a horizontal progress representation as part of the wait panel

### Requirement: Optional factual secondary status from server

The system MAY show a **secondary** English line from polled analysis status when it conveys queue or synchronization context only; that line MUST remain subordinate to the generic primary line and MUST NOT replace the progress bar.

#### Scenario: Secondary line does not become a checklist

- **WHEN** a secondary line is visible under the primary wait message
- **THEN** it SHALL NOT, by itself, satisfy the applicant that each eligibility criterion has been individually passed or failed in sequence

### Requirement: Ineligible outcome shows reasons

When `applicationStatus` is `INELIGIBLE`, the applicant-facing view SHALL present a clear **not eligible** outcome and SHALL surface applicant-appropriate reason text supplied with the result (for example summary and detailed reason fields already returned by the application), without claiming to show internal engine diagnostics beyond that text.

#### Scenario: Ineligible session sees outcome copy

- **WHEN** `applicationStatus` is `INELIGIBLE`
- **THEN** the page SHALL include a prominent outcome treatment that includes the program’s reason content intended for applicants

### Requirement: Eligible path points to materials

When the applicant is eligible to continue toward supporting materials under existing flow rules (including after successful detailed analysis when that gate applies), the applicant-facing copy on `/apply/result` SHALL explicitly direct them to **supporting materials** (or equivalent product wording) as the **next** action rather than describing internal analysis mechanics.

#### Scenario: Post-detailed-review eligible state mentions materials

- **WHEN** `applicationStatus` is `SECONDARY_REVIEW`
- **THEN** the primary instructional copy visible on the result page SHALL name the supporting materials step as the next stage the applicant should complete

### Requirement: Expert program contact with mailto

The `/apply/result` page SHALL display a single English sentence inviting **experts** (not applicants) to contact the program team, including a **mailto** hyperlink whose address is read from the implementation’s configured placeholder until replaced.

#### Scenario: Mail link uses configured address

- **WHEN** a visitor loads `/apply/result` with a loaded application snapshot
- **THEN** the view SHALL include an English-labeled `mailto:` link for expert contact
- **AND** the link target SHALL use the placeholder mailbox value defined in implementation constants until operations updates that value

### Requirement: English applicant copy

All normative applicant-visible strings introduced or modified by this capability for `/apply/result` and the apply flow stepper labels within scope SHALL be written in **English**.

#### Scenario: New strings are English

- **WHEN** the system renders screening-related headings, wait messages, expert contact sentence, or updated stepper labels covered by this spec
- **THEN** those strings SHALL use English words and punctuation suitable for the public apply UI
