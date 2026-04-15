# resume-analysis-progress

## Purpose

Defines requirements for the in-flow wait experience while resume analysis (initial or re-analysis) or detailed secondary analysis runs: a time-calibrated, monotonic progress indicator, canonical English stage messaging aligned to extraction and eligibility assessment concepts, and optional use of server `progressMessage` without implying false backend observability.

## ADDED Requirements

### Requirement: Time-based monotonic progress bar

While the applicant session is in an analyzing status that uses the analysis wait panel (`CV_ANALYZING`, `REANALYZING`, or `SECONDARY_ANALYZING`), the system SHALL render a horizontal progress fill whose displayed completion ratio is a **non-decreasing** function of **elapsed wall time** since the applicant entered that analyzing status for the current segment.

#### Scenario: Typical run reaches upper-mid bar near 32 seconds

- **WHEN** the session remains continuously in one of the analyzing statuses above
- **AND** approximately thirty-two seconds have elapsed since entry into that status
- **THEN** the displayed fill SHALL be visibly in the **upper mid-range** of the bar track (between seventy and eighty-five percent of the track width implied by the design’s pre-completion cap)
- **AND** the fill SHALL NOT reach one hundred percent of the track while the analyzing status persists

#### Scenario: Slow runs crawl then hold before completion

- **WHEN** the analyzing status persists beyond thirty-two seconds and up to sixty seconds
- **THEN** the displayed fill SHALL continue to advance slowly toward a **pre-completion cap** not exceeding ninety-three percent of the track
- **WHEN** sixty seconds have elapsed and the analyzing status still persists
- **THEN** the displayed fill SHALL remain fixed at that cap until the analyzing status ends or the job reaches a terminal outcome handled by the result page

### Requirement: Piecewise calibration for the 30–60 second expectation window

The mapping from elapsed time to displayed fill SHALL use a **piecewise-linear** curve with at least three segments: an initial segment from zero to twelve seconds, a middle segment ending at thirty-two seconds, and a final segment ending at sixty seconds, such that empirical runs around thirty-two seconds land in the upper mid-range as specified above.

#### Scenario: No backward motion on status-only polls

- **WHEN** repeated successful polls refresh `progressMessage` or related fields without changing the analyzing `applicationStatus`
- **THEN** the displayed fill ratio SHALL NOT decrease compared to its prior value for that analyzing segment

### Requirement: Segment clock reset on analyzing entry

The elapsed time reference for the progress bar SHALL reset to zero when the `applicationStatus` transitions **into** `CV_ANALYZING`, `REANALYZING`, or `SECONDARY_ANALYZING` from a non-analyzing status, or when it transitions **between** these analyzing statuses (each segment owns an independent clock).

#### Scenario: Fresh bar after re-analysis is triggered

- **WHEN** the session transitions from a non-analyzing status into `REANALYZING`
- **THEN** the progress fill SHALL restart from the empty state for that segment per the reset rule above

### Requirement: Canonical primary stage messages

For `CV_ANALYZING` and `REANALYZING`, the system SHALL show exactly **one** primary English status line at a time from a **fixed ordered list of six** user-facing messages that map conceptually to: document intake; extraction of birth year, degrees, and doctoral milestones; current title, employment country, and recent experience; research areas; eligibility rule application; consolidation toward structured review output.

#### Scenario: Messages advance with elapsed time bands

- **WHEN** elapsed time since entering the current primary analyzing segment is within zero to eight seconds
- **THEN** the primary line SHALL correspond to the list item for document intake
- **WHEN** elapsed time is at least eight seconds and below sixteen seconds
- **THEN** the primary line SHALL correspond to the list item for education and doctoral detail extraction
- **WHEN** elapsed time is at least sixteen seconds and below twenty-four seconds
- **THEN** the primary line SHALL correspond to the list item for current role, country, and twenty-twenty-or-later experience
- **WHEN** elapsed time is at least twenty-four seconds and below thirty-two seconds
- **THEN** the primary line SHALL correspond to the list item for research areas
- **WHEN** elapsed time is at least thirty-two seconds and below forty-five seconds
- **THEN** the primary line SHALL correspond to the list item for eligibility rules
- **WHEN** elapsed time is forty-five seconds or greater while still analyzing
- **THEN** the primary line SHALL correspond to the list item for consolidation toward structured review

### Requirement: Secondary analyzing message set

For `SECONDARY_ANALYZING`, the system SHALL use a **distinct** ordered list of between three and four English primary messages focused on detailed expert-facing analysis and readiness for later stages, while reusing the **same** time-based progress bar rules as primary analysis.

#### Scenario: Detailed analysis shows its own first stage

- **WHEN** `applicationStatus` is `SECONDARY_ANALYZING` and elapsed time is in the first band of that mode’s list
- **THEN** the primary line SHALL be taken from the secondary list’s first item (not from the six-item primary list)

### Requirement: Server progress message as optional secondary line

The system MAY render `progressMessage` from `fetchAnalysisStatus` as a **secondary** line beneath the primary stage line when it adds factual queue or synchronization context; the primary stage line from the canonical lists SHALL remain authoritative for normal processing states.

#### Scenario: Queue or sync wording is visible

- **WHEN** the polled `jobStatus` indicates queued or the `progressMessage` contains queue- or sync-oriented wording defined at implementation time (for example “queued” or “syncing”, case-insensitive)
- **THEN** the UI SHALL show that `progressMessage` as a secondary line without replacing the primary staged message

### Requirement: No internal assessor markup in the UI

The analysis wait UI SHALL NOT display model delimiter formats used in internal prompts or outputs (including triple-bracket, triple-brace, or triple-exclamation patterns used for extracted reasoning, final sentences, or missing-item markers).

#### Scenario: Applicant never sees delimiter tokens

- **WHEN** the analysis wait panel is visible during any analyzing status
- **THEN** the rendered primary and secondary user-visible strings SHALL NOT include those delimiter patterns as literal UI text

### Requirement: Long-wait acknowledgment

If the analyzing status persists beyond sixty seconds, the system SHALL continue to hold the bar at the pre-completion cap and SHALL adjust the primary or secondary copy so the applicant is informed that processing is still running (exact English wording is implementation-defined but MUST NOT claim false completion).

#### Scenario: Extended processing copy

- **WHEN** elapsed time in the current analyzing segment exceeds sixty seconds
- **THEN** the user-visible messaging SHALL include an explicit still-running indication in English

### Requirement: Smooth local updates without tightening poll interval

The progress bar animation SHALL be driven by a local high-frequency clock (for example `requestAnimationFrame` or a sub-second interval) while retaining the existing approximately two-second polling interval for `fetchAnalysisStatus`, unless a future change explicitly updates polling requirements.

#### Scenario: Bar updates between polls

- **WHEN** two consecutive polls are two seconds apart
- **THEN** the progress fill SHALL update visually at least once within that interval independent of poll callbacks
