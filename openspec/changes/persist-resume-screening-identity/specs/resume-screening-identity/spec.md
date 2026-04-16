# resume-screening-identity

## Purpose

Defines persistence and validation for **Passport Full Name** and **contact email** that experts declare on the resume upload step, stored on the server as screening credentials for the application.

## ADDED Requirements

### Requirement: Application stores screening passport full name

The system SHALL persist a trimmed **passport full name** string supplied at resume upload confirmation on the `Application` record associated with that session.

#### Scenario: Confirm resume with valid name persists value

- **WHEN** an authorized client calls the resume confirm endpoint with valid file metadata, object key, passport full name, and email
- **THEN** the corresponding `Application` row SHALL contain the trimmed passport full name in the designated screening field

### Requirement: Application stores screening contact email

The system SHALL persist a normalized **contact email** supplied at resume upload confirmation on the same `Application` record.

#### Scenario: Confirm resume with valid email persists value

- **WHEN** an authorized client calls the resume confirm endpoint with valid file metadata, object key, passport full name, and a syntactically valid email address
- **THEN** the corresponding `Application` row SHALL contain that email in the designated screening field

### Requirement: Resume confirm rejects invalid identity payload

The resume confirm endpoint SHALL reject requests with missing, whitespace-only passport full name, or syntactically invalid email before creating a new resume file record.

#### Scenario: Empty passport name returns client error

- **WHEN** the passport full name is missing or only whitespace after trim
- **THEN** the server SHALL respond with `400` and SHALL NOT create a new `ResumeFile` for that request

#### Scenario: Invalid email returns client error

- **WHEN** the email fails syntactic validation
- **THEN** the server SHALL respond with `400` and SHALL NOT create a new `ResumeFile` for that request

### Requirement: Resume page sends identity fields on confirm

The `/apply/resume` client flow SHALL include the same passport full name and email values the expert entered in the confirm request body together with file metadata.

#### Scenario: Successful upload includes identity in confirm body

- **WHEN** the expert completes a resume upload from `/apply/resume` with non-empty identity fields
- **THEN** the confirm HTTP request body SHALL include those two fields alongside `fileName`, `fileType`, `fileSize`, and `objectKey`
