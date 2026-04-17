# apply-entry-intro-copy

## Purpose

Defines applicant-facing English copy and layout for the public `/apply` introduction: hero text, accordion sections (including GESF overview, competitive package, eligibility, online process, timeline, and service provider), typographic treatment of the main headline, and exclusion of non-English content from the timeline block—without changing invitation validation or session APIs.

## ADDED Requirements

### Requirement: Hero description and deadline pill

On the `/apply` introduction route, the system SHALL render the `PageShell` description text that states applications are accepted year-round and that the formal **2026** application window closes in **mid-June**.

#### Scenario: Header copy matches policy

- **WHEN** a visitor loads `/apply` successfully and the introduction header is visible
- **THEN** the description SHALL include both the year-round admissions notion and the mid-June **2026** window closing statement as a single coherent English message

#### Scenario: Deadline pill uses mid-June 2026 wording

- **WHEN** the header slot pill is visible on `/apply`
- **THEN** it SHALL present an **Application Deadline** style label referencing **Mid-June 2026** (not a generic “Q2 2026” period label)

### Requirement: Primary headline is not bold

On `/apply` only, the primary `PageShell` title rendered for “Global Excellent Scientists Fund” SHALL use a **non-bold** typographic weight (for example normal or medium) while remaining the page’s main heading for accessibility.

#### Scenario: Title weight differs from default PageShell emphasis

- **WHEN** `/apply` is rendered with the introduction `PageShell` header
- **THEN** the main title element SHALL NOT use the same bold/semi-bold default weight applied to other routes that do not pass an explicit override (regression checked by comparing class lists or computed style in QA)

### Requirement: GESF overview section content

The introduction SHALL include an accordion section titled **Global Excellent Scientists Fund (GESF)** whose summary line is **Program Mission & Objectives** and whose body SHALL explain the national program mission, overseas scholar audience (including Hong Kong, Macau, and Taiwan), and SHALL list the sub-projects **Qiming (QM)**, **Torch Plan (HJ)**, and **Changjiang Scholar** as a bulleted list with visible disc markers.

#### Scenario: Sub-projects show as bullets

- **WHEN** the visitor expands the GESF overview section
- **THEN** the three sub-project names SHALL each appear as its own bullet with a standard filled disc list marker

### Requirement: Competitive package section

The introduction SHALL include a **Benefits** (or equivalent) accordion section whose summary is **Competitive Package** and whose body SHALL enumerate the annual salary range, talent reward range and payment horizon, comprehensive benefits (housing, children’s schooling support, tax benefits), and the **National High-Level Talent** title—using the stakeholder-approved English wording and ordering.

#### Scenario: Package list is complete

- **WHEN** the visitor expands the competitive package section
- **THEN** the body SHALL include all four items above in clear English without reintroducing removed legacy benefit lines that contradict the new list (for example omitting extra nationality or relocation lines unless separately specified)

### Requirement: Eligibility rules section

The introduction SHALL include an **Eligibility** accordion section whose body SHALL state the Ph.D. requirement, the **three consecutive years** of work experience outside mainland China **after** obtaining the Ph.D., and the over-40 associate-professor-or-higher rule—using the stakeholder English wording.

#### Scenario: Three eligibility statements

- **WHEN** the visitor expands eligibility
- **THEN** exactly three normative eligibility statements SHALL be visible matching the approved copy intent above

### Requirement: Online application process section

The introduction SHALL include an accordion section whose title expresses the **online application process** in English (for example **Online Application Process**) and whose body SHALL retain the five-step journey visualization and SHALL replace the prior “intentionally linear journey” prose with statements that the process is linear and cannot be bypassed, progress can be saved at each stage, and applicants receive feedback within **one week** of final submission.

#### Scenario: Process guidance matches cadence rules

- **WHEN** the visitor expands the online application process section
- **THEN** the explanatory text SHALL include the linearity/non-bypass rule, save-at-each-stage rule, and one-week feedback-after-final-submission rule in English

### Requirement: Timeline and key dates (English-only)

The introduction SHALL include a **Timeline & Key Dates** section (accordion or equivalent prominent block) whose title and all visible bullet text are **English only**, covering rolling admissions, the **2026** mid-June deadline, **December 2026** notification for applications submitted before the deadline, and a **two-year** consideration window with arrival in China as late as **early 2029** for the **2026** cohort.

#### Scenario: No Chinese copy in timeline block

- **WHEN** the timeline section is visible on `/apply`
- **THEN** no Chinese characters SHALL appear inside that section’s title, summary, or list items

#### Scenario: Four timeline bullets

- **WHEN** the visitor expands the timeline section
- **THEN** at least four English bullet points SHALL be present covering rolling admissions, 2026 deadline, December 2026 notification, and flexibility through early 2029

### Requirement: Non-goals preserved

This capability SHALL NOT require changes to invitation link parsing, session fetch endpoints, redirect rules from `/apply`, or background image behavior governed by `apply-entry-appearance`.

#### Scenario: Session behavior unchanged

- **WHEN** a returning applicant opens `/apply` with the same flows supported today
- **THEN** invitation restoration, read-only banners, and navigation to `/apply/resume` after confirmation SHALL behave as before this copy change aside from updated static text
