## ADDED Requirements

### Requirement: Entry route background image

The system SHALL render a full-area static PNG background on the public application introduction route whose path is exactly `/apply` (the entry page), using the asset served at `/apply/entry-background.png` from the project `public` directory.

#### Scenario: Visitor opens the apply introduction

- **WHEN** a client requests the `/apply` page successfully
- **THEN** the rendered view SHALL include a non-interactive background layer that displays the PNG referenced above with `background-size` covering the background layer and `background-position` centered

### Requirement: Sub-routes excluded

The system SHALL NOT apply that PNG background layer to other segments under the `/apply` path prefix (including but not limited to `/apply/resume`, `/apply/materials`, and `/apply/result`).

#### Scenario: Applicant continues past the introduction

- **WHEN** a client navigates to `/apply/resume` or any other `/apply/*` route other than the exact `/apply` entry
- **THEN** the PNG background layer defined in this capability SHALL NOT be present on that page

### Requirement: Foreground readability

The system SHALL preserve legible contrast for primary text, the flow stepper, status banners, and primary actions on `/apply` by placing a visual scrim or equivalent wash between the photograph and foreground content.

#### Scenario: Default introduction content is visible

- **WHEN** the `/apply` page is rendered with typical introduction content and the configured PNG is present
- **THEN** foreground typography and controls SHALL remain visually distinguishable from the background without requiring user zoom

### Requirement: Stacking with global page chrome

The background image layer SHALL render above the global `body` background and `body::before` decorative layers while remaining below interactive foreground content.

#### Scenario: Global styles remain underneath

- **WHEN** the `/apply` page is rendered
- **THEN** the photograph layer SHALL not replace or disable the root document background; interactive elements SHALL receive pointer events as before this capability

### Requirement: Non-functional surface

The introduction background SHALL be purely decorative for branding: it MUST NOT convey information required to complete the application, and the implementation MUST NOT introduce new server endpoints or change application session or invitation validation behavior.

#### Scenario: Invitation flow unchanged

- **WHEN** a user completes invitation verification and introduction actions as supported today
- **THEN** the system SHALL exhibit the same navigation and API behavior as prior to this capability aside from visual presentation on `/apply`
