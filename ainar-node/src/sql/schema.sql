-- AINAR canonical model — PostgreSQL schema.
--
-- Generated content is imported into this by `ainar sql`. The DDL itself is
-- hand-written and reviewed, because it is the contract between this workspace
-- and the Professor Exoskeleton application, and a contract should be readable.
--
-- Three conventions run through the whole file:
--
--   1. Every row has a surrogate `id UUID` and a human `code TEXT`. The code is
--      what the YAML holds — `LO-04`, `CRIT-04-01` — and it is UNIQUE. The
--      importer derives the UUID from the code with uuid5 under a fixed
--      namespace, so an import is idempotent and the same content always lands
--      on the same rows.
--
--   2. Deleting course design must never silently destroy student evidence.
--      Within a course version, children cascade. Anything in `learning` that
--      points at `academic` uses ON DELETE RESTRICT: you cannot remove an
--      outcome that a student has demonstrated without dealing with the
--      evidence first.
--
--   3. Columns used for joins, filtering, permissions and reporting are real
--      columns. Optional, type-specific or faculty-specific configuration goes
--      in JSONB — `settings` for assessment behaviour, `extensions` for the
--      per-faculty fields the core model deliberately does not grow.
--
-- Requires PostgreSQL 13+ (gen_random_uuid is built in from 13).

CREATE SCHEMA IF NOT EXISTS academic;
CREATE SCHEMA IF NOT EXISTS delivery;
CREATE SCHEMA IF NOT EXISTS assessment;
CREATE SCHEMA IF NOT EXISTS learning;
CREATE SCHEMA IF NOT EXISTS content;


-- ==========================================================================
-- content — the files behind everything else
-- ==========================================================================

CREATE TABLE IF NOT EXISTS content.documents (
    id              UUID PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    -- No scheme means a path in the content repository; `object://` means the
    -- application's object store holds the bytes and this row is metadata.
    storage_key     TEXT NOT NULL UNIQUE,
    mime_type       TEXT NOT NULL,
    original_filename TEXT,
    size_bytes      BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
    checksum        TEXT,
    uploaded_by     TEXT,
    created_at      TIMESTAMPTZ,
    version         INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    supersedes_id   UUID REFERENCES content.documents(id) ON DELETE SET NULL,
    -- Set when an agent produced the file, so a reader can always tell.
    generated_by    JSONB,
    presentation_plan JSONB,
    extensions      JSONB NOT NULL DEFAULT '{}'
);


-- ==========================================================================
-- academic — the stable definition of what is taught
-- ==========================================================================

CREATE TABLE IF NOT EXISTS academic.courses (
    id          UUID PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL,
    description TEXT,
    credits     NUMERIC(5, 2) CHECK (credits IS NULL OR credits >= 0),
    department  TEXT,
    language    TEXT[] NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('draft', 'active', 'retired')),
    owner_code  TEXT,
    extensions  JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS academic.capabilities (
    id          UUID PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL,
    description TEXT,
    domain      TEXT,
    -- [{level, description}, ...] in ascending order. Always read with the
    -- capability and never queried on its own, so it does not earn a table.
    levels      JSONB NOT NULL DEFAULT '[]',
    extensions  JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS academic.concepts (
    id                UUID PRIMARY KEY,
    code              TEXT NOT NULL UNIQUE,
    title             TEXT NOT NULL,
    description       TEXT,
    -- NULL for concepts shared across courses.
    course_id         UUID REFERENCES academic.courses(id) ON DELETE CASCADE,
    aliases           TEXT[] NOT NULL DEFAULT '{}',
    -- The graph, inline. It was a junction table until the schema was flattened:
    -- `academic` is read whole, never queried across students, and every
    -- reference here is checked by `ainar validate` before import. Index with GIN
    -- if "which concepts require this one" ever becomes a query.
    prerequisite_codes TEXT[] NOT NULL DEFAULT '{}',
    related_codes     TEXT[] NOT NULL DEFAULT '{}',
    extensions        JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS academic.learning_outcomes (
    id                UUID PRIMARY KEY,
    code              TEXT NOT NULL UNIQUE,
    -- The definition belongs to the course, not to a revision of it: an outcome
    -- that renumbered on revision would strand the evidence pointing at it.
    course_id         UUID NOT NULL REFERENCES academic.courses(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    description       TEXT,
    cognitive_levels  TEXT[] NOT NULL DEFAULT '{}',
    weight            NUMERIC(5, 4) CHECK (weight IS NULL OR (weight >= 0 AND weight <= 1)),
    concept_codes     TEXT[] NOT NULL DEFAULT '{}',
    capability_codes  TEXT[] NOT NULL DEFAULT '{}',
    extensions        JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS academic.modules (
    id                UUID PRIMARY KEY,
    code              TEXT NOT NULL UNIQUE,
    course_id         UUID NOT NULL REFERENCES academic.courses(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    description       TEXT,
    week              INTEGER CHECK (week IS NULL OR week >= 1),
    ordering          INTEGER CHECK (ordering IS NULL OR ordering >= 1),
    estimated_hours   NUMERIC(6, 2) CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
    outcome_codes     TEXT[] NOT NULL DEFAULT '{}',
    concept_codes     TEXT[] NOT NULL DEFAULT '{}',
    extensions        JSONB NOT NULL DEFAULT '{}'
);


-- ==========================================================================
-- delivery — one semester of a course
-- ==========================================================================

CREATE TABLE IF NOT EXISTS delivery.users (
    id           UUID PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email        TEXT,
    role         TEXT,
    external_ids JSONB NOT NULL DEFAULT '{}',
    extensions   JSONB NOT NULL DEFAULT '{}'
);

-- Stable link between an external OAuth issuer/subject pair and the internal
-- professor account. Email is deliberately not an identity key: it can change,
-- be reassigned, or be unverified.
CREATE TABLE IF NOT EXISTS delivery.user_identities (
    issuer     TEXT NOT NULL,
    subject    TEXT NOT NULL,
    user_id    UUID NOT NULL REFERENCES delivery.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (issuer, subject),
    UNIQUE (issuer, user_id)
);

-- One offering of a course in one term, and the version approved for it.
--
-- This was two tables: delivery.course_versions held the approved definition
-- and delivery.course_versions held the semester. The definition never varied and
-- now belongs to the course, so the two collapsed into this one. It lives in
-- `delivery` because it is overwhelmingly a delivery record, which leaves
-- `academic` as pure definition.
CREATE TABLE IF NOT EXISTS delivery.course_versions (
    id                  UUID PRIMARY KEY,
    code                TEXT NOT NULL UNIQUE,
    course_id           UUID NOT NULL REFERENCES academic.courses(id) ON DELETE RESTRICT,
    approved_by         TEXT,
    syllabus_document_id UUID REFERENCES content.documents(id) ON DELETE SET NULL,
    notes               TEXT,
    term                TEXT NOT NULL,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    timezone            TEXT NOT NULL DEFAULT 'Asia/Almaty',
    status              TEXT NOT NULL DEFAULT 'planned'
                        CHECK (status IN
                               ('planned', 'scheduled', 'running', 'completed', 'cancelled')),
    lms_course_id       TEXT,
    section             TEXT,
    expected_enrollment INTEGER CHECK (expected_enrollment IS NULL OR expected_enrollment >= 0),
    extensions          JSONB NOT NULL DEFAULT '{}',
    CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS delivery.run_staff (
    course_run_id UUID NOT NULL REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES delivery.users(id) ON DELETE RESTRICT,
    role          TEXT NOT NULL CHECK (role IN ('instructor', 'assistant')),
    PRIMARY KEY (course_run_id, user_id, role)
);

-- Student-facing Telegram announcements are a shared-backend integration.
-- The bot token is never stored here; it lives in the backend secret store.
-- One run maps to at most one channel so a publish cannot fan out accidentally.
CREATE TABLE IF NOT EXISTS delivery.telegram_channels (
    course_run_id UUID PRIMARY KEY REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    chat_id       TEXT NOT NULL,
    title         TEXT,
    enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    configured_by UUID REFERENCES delivery.users(id) ON DELETE SET NULL,
    configured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE delivery.telegram_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telegram_channel_staff_access ON delivery.telegram_channels;
CREATE POLICY telegram_channel_staff_access
    ON delivery.telegram_channels
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
              FROM delivery.run_staff AS staff
             WHERE staff.course_run_id = telegram_channels.course_run_id
               AND staff.user_id = NULLIF(current_setting('ainar.user_id', true), '')::UUID
        )
    );

-- `student_code` is a pseudonym. The mapping to a real identity lives outside
-- both this database and the content repository; see `ainar roster`.
CREATE TABLE IF NOT EXISTS delivery.enrollments (
    id            UUID PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    course_run_id UUID NOT NULL REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    student_code  TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'student'
                  CHECK (role IN
                         ('student', 'auditor', 'instructor', 'teaching_assistant', 'observer')),
    status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'dropped', 'completed', 'pending')),
    student_group TEXT,
    extensions    JSONB NOT NULL DEFAULT '{}',
    UNIQUE (course_run_id, student_code)
);

CREATE TABLE IF NOT EXISTS delivery.resources (
    id                UUID PRIMARY KEY,
    code              TEXT NOT NULL UNIQUE,
    title             TEXT NOT NULL,
    kind              TEXT NOT NULL DEFAULT 'other',
    course_run_id     UUID REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    course_id         UUID REFERENCES academic.courses(id) ON DELETE CASCADE,
    document_id       UUID REFERENCES content.documents(id) ON DELETE SET NULL,
    url               TEXT,
    description       TEXT,
    required          BOOLEAN NOT NULL DEFAULT FALSE,
    extensions        JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS delivery.resource_concepts (
    resource_id UUID NOT NULL REFERENCES delivery.resources(id) ON DELETE CASCADE,
    concept_id  UUID NOT NULL REFERENCES academic.concepts(id) ON DELETE CASCADE,
    PRIMARY KEY (resource_id, concept_id)
);

CREATE TABLE IF NOT EXISTS delivery.learning_activities (
    id               UUID PRIMARY KEY,
    code             TEXT NOT NULL UNIQUE,
    course_run_id    UUID NOT NULL REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    module_id        UUID REFERENCES academic.modules(id) ON DELETE SET NULL,
    activity_type    TEXT NOT NULL,
    title            TEXT NOT NULL,
    description      TEXT,
    scheduled_at     TIMESTAMPTZ,
    duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
    location         TEXT,
    preparation      TEXT,
    extensions       JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS delivery.activity_outcomes (
    activity_id UUID NOT NULL REFERENCES delivery.learning_activities(id) ON DELETE CASCADE,
    outcome_id  UUID NOT NULL REFERENCES academic.learning_outcomes(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_id, outcome_id)
);

CREATE TABLE IF NOT EXISTS delivery.activity_concepts (
    activity_id UUID NOT NULL REFERENCES delivery.learning_activities(id) ON DELETE CASCADE,
    concept_id  UUID NOT NULL REFERENCES academic.concepts(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_id, concept_id)
);

CREATE TABLE IF NOT EXISTS delivery.activity_resources (
    activity_id UUID NOT NULL REFERENCES delivery.learning_activities(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES delivery.resources(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_id, resource_id)
);


-- ==========================================================================
-- assessment — how learning is measured
-- ==========================================================================

CREATE TABLE IF NOT EXISTS assessment.rubrics (
    id          UUID PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    title       TEXT,
    description TEXT,
    extensions  JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS assessment.assessments (
    id             UUID PRIMARY KEY,
    code           TEXT NOT NULL UNIQUE,
    course_run_id  UUID NOT NULL REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    module_id      UUID REFERENCES academic.modules(id) ON DELETE SET NULL,
    rubric_id      UUID REFERENCES assessment.rubrics(id) ON DELETE SET NULL,
    title          TEXT NOT NULL,
    assessment_type TEXT NOT NULL,
    description    TEXT,
    maximum_score  NUMERIC(8, 2) NOT NULL CHECK (maximum_score > 0),
    -- [{score, label, description}, ...]. Read with the criterion, never alone.
    levels         JSONB NOT NULL DEFAULT '[]',
    weight         NUMERIC(5, 4) CHECK (weight IS NULL OR (weight >= 0 AND weight <= 1)),
    opens_at       TIMESTAMPTZ,
    due_at         TIMESTAMPTZ,
    submission_type TEXT[] NOT NULL DEFAULT '{}',
    -- Where the work arrives, as against what shape it is in: canvas_upload,
    -- github_repo, paper_exam, oral_defense, presentation,
    -- instructor_collected, other. Decides which import path exists at all, so
    -- the application can filter on it rather than guessing from settings.
    delivery       TEXT,
    instructions_document_id UUID REFERENCES content.documents(id) ON DELETE SET NULL,
    -- Type-specific behaviour: anonymous_grading, allow_late_submission,
    -- ai_review.require_professor_approval, and so on.
    settings       JSONB NOT NULL DEFAULT '{}',
    -- The reviewable outcome x cognitive-level x difficulty x item-type plan.
    design         JSONB,
    extensions     JSONB NOT NULL DEFAULT '{}',
    CHECK (opens_at IS NULL OR due_at IS NULL OR opens_at <= due_at)
);

CREATE TABLE IF NOT EXISTS assessment.assessment_outcomes (
    assessment_id UUID NOT NULL REFERENCES assessment.assessments(id) ON DELETE CASCADE,
    outcome_id    UUID NOT NULL REFERENCES academic.learning_outcomes(id) ON DELETE CASCADE,
    PRIMARY KEY (assessment_id, outcome_id)
);

-- The link from criterion to outcome is what turns a mark into evidence.
-- A criterion with a NULL outcome_id produces a score and nothing else.
CREATE TABLE IF NOT EXISTS assessment.rubric_criteria (
    id            UUID PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    rubric_id     UUID NOT NULL REFERENCES assessment.rubrics(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    description   TEXT,
    maximum_score NUMERIC(8, 2) NOT NULL CHECK (maximum_score > 0),
    levels        JSONB NOT NULL DEFAULT '[]',
    weight        NUMERIC(5, 4),
    outcome_id    UUID REFERENCES academic.learning_outcomes(id) ON DELETE RESTRICT,
    capability_id UUID REFERENCES academic.capabilities(id) ON DELETE RESTRICT,
    extensions    JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS assessment.criterion_concepts (
    criterion_id UUID NOT NULL REFERENCES assessment.rubric_criteria(id) ON DELETE CASCADE,
    concept_id   UUID NOT NULL REFERENCES academic.concepts(id) ON DELETE CASCADE,
    PRIMARY KEY (criterion_id, concept_id)
);

CREATE TABLE IF NOT EXISTS assessment.item_models (
    id                    UUID PRIMARY KEY,
    code                  TEXT NOT NULL UNIQUE,
    course_run_id         UUID NOT NULL REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    title                 TEXT NOT NULL,
    outcome_id            UUID REFERENCES academic.learning_outcomes(id) ON DELETE RESTRICT,
    capability_id         UUID REFERENCES academic.capabilities(id) ON DELETE RESTRICT,
    cognitive_level       TEXT NOT NULL,
    evidence_requirements JSONB NOT NULL DEFAULT '[]',
    task_structure        JSONB NOT NULL DEFAULT '[]',
    scenario_variables    JSONB NOT NULL DEFAULT '{}',
    difficulty_features   JSONB NOT NULL DEFAULT '{}',
    answer_requirements   JSONB NOT NULL DEFAULT '[]',
    allowed_item_types    TEXT[] NOT NULL DEFAULT '{}',
    extensions            JSONB NOT NULL DEFAULT '{}',
    CHECK (outcome_id IS NOT NULL OR capability_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS assessment.item_model_concepts (
    item_model_id UUID NOT NULL REFERENCES assessment.item_models(id) ON DELETE CASCADE,
    concept_id    UUID NOT NULL REFERENCES academic.concepts(id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK (role IN ('construct', 'misconception')),
    PRIMARY KEY (item_model_id, concept_id, role)
);

CREATE TABLE IF NOT EXISTS assessment.assessment_items (
    id               UUID PRIMARY KEY,
    code             TEXT NOT NULL UNIQUE,
    assessment_id    UUID NOT NULL REFERENCES assessment.assessments(id) ON DELETE CASCADE,
    item_model_id    UUID REFERENCES assessment.item_models(id) ON DELETE SET NULL,
    criterion_id     UUID REFERENCES assessment.rubric_criteria(id) ON DELETE SET NULL,
    outcome_id       UUID REFERENCES academic.learning_outcomes(id) ON DELETE RESTRICT,
    item_number      INTEGER CHECK (item_number IS NULL OR item_number >= 1),
    item_type        TEXT NOT NULL,
    prompt           TEXT NOT NULL,
    -- Zero is allowed here and nowhere else in the model: it is how an unmarked
    -- question is written, typically a `preparation` item whose answer is worth
    -- recording and whose marks are not the point. Anything computing a success
    -- rate from this column has to guard for it.
    maximum_score    NUMERIC(8, 2) NOT NULL CHECK (maximum_score >= 0),
    -- preparation | main | followup. A preparation item is asked before the work,
    -- so `ainar extract-evidence` derives no learning evidence from it.
    item_role        TEXT NOT NULL DEFAULT 'main',
    -- easy | medium | complex, as *declared*. The observed rate is derived from
    -- item_responses; the two disagreeing is the point of recording this.
    difficulty       TEXT,
    answer_key       TEXT,
    marking_guidance TEXT,
    extensions       JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS assessment.item_concepts (
    item_id    UUID NOT NULL REFERENCES assessment.assessment_items(id) ON DELETE CASCADE,
    concept_id UUID NOT NULL REFERENCES academic.concepts(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, concept_id)
);

-- `indicates_misconception_of` is what turns "12 students chose (b)" into a
-- statement about what those 12 students believe.
CREATE TABLE IF NOT EXISTS assessment.item_options (
    item_id       UUID NOT NULL REFERENCES assessment.assessment_items(id) ON DELETE CASCADE,
    label         TEXT NOT NULL,
    body          TEXT NOT NULL,
    is_correct    BOOLEAN NOT NULL DEFAULT FALSE,
    indicates_misconception_of UUID REFERENCES academic.concepts(id) ON DELETE SET NULL,
    note          TEXT,
    PRIMARY KEY (item_id, label)
);

CREATE TABLE IF NOT EXISTS assessment.submissions (
    id            UUID PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    assessment_id UUID NOT NULL REFERENCES assessment.assessments(id) ON DELETE CASCADE,
    student_code  TEXT NOT NULL,
    submitted_at  TIMESTAMPTZ,
    status        TEXT NOT NULL DEFAULT 'submitted',
    attempt       INTEGER NOT NULL DEFAULT 1 CHECK (attempt >= 1),
    note          TEXT,
    extensions    JSONB NOT NULL DEFAULT '{}',
    UNIQUE (assessment_id, student_code, attempt)
);

CREATE TABLE IF NOT EXISTS assessment.submission_files (
    submission_id UUID NOT NULL REFERENCES assessment.submissions(id) ON DELETE CASCADE,
    document_id   UUID NOT NULL REFERENCES content.documents(id) ON DELETE RESTRICT,
    file_type     TEXT NOT NULL,
    PRIMARY KEY (submission_id, document_id)
);

CREATE TABLE IF NOT EXISTS assessment.item_responses (
    id             UUID PRIMARY KEY,
    code           TEXT NOT NULL UNIQUE,
    submission_id  UUID NOT NULL REFERENCES assessment.submissions(id) ON DELETE CASCADE,
    item_id        UUID NOT NULL REFERENCES assessment.assessment_items(id) ON DELETE RESTRICT,
    student_code   TEXT NOT NULL,
    chosen_options TEXT[] NOT NULL DEFAULT '{}',
    raw_response   TEXT,
    score          NUMERIC(8, 2) CHECK (score IS NULL OR score >= 0),
    correct        BOOLEAN,
    scored_by      TEXT,
    responded_at   TIMESTAMPTZ,
    extensions     JSONB NOT NULL DEFAULT '{}',
    UNIQUE (submission_id, item_id)
);

-- The central separation of the whole model.
--
-- An AI suggestion and a professor's decision are different kinds of thing and
-- live in different columns. A decision never overwrites a suggestion, which is
-- what makes the grade auditable and what makes the agent measurable: after a
-- semester, comparing the two columns says how often the professor agreed.
CREATE TABLE IF NOT EXISTS assessment.evaluations (
    id            UUID PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    submission_id UUID NOT NULL REFERENCES assessment.submissions(id) ON DELETE CASCADE,
    criterion_id  UUID NOT NULL REFERENCES assessment.rubric_criteria(id) ON DELETE RESTRICT,
    status        TEXT NOT NULL DEFAULT 'suggested'
                  CHECK (status IN ('suggested', 'in_review', 'approved', 'overridden')),

    suggested_score      NUMERIC(8, 2),
    suggested_confidence NUMERIC(4, 3)
                         CHECK (suggested_confidence IS NULL
                                OR (suggested_confidence >= 0 AND suggested_confidence <= 1)),
    suggested_comment    TEXT,
    suggested_evidence   JSONB,
    suggestion_provenance JSONB,

    decided_score   NUMERIC(8, 2),
    decision_comment TEXT,
    decided_by      TEXT,
    decided_at      TIMESTAMPTZ,

    extensions      JSONB NOT NULL DEFAULT '{}',
    UNIQUE (submission_id, criterion_id),

    -- A record may not claim to be decided without the audit stamp that says
    -- who decided it and when. This is the database half of the guarantee the
    -- content validator enforces on the way in.
    CONSTRAINT decided_rows_are_stamped CHECK (
        status NOT IN ('approved', 'overridden')
        OR (decided_score IS NOT NULL AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS evaluations_awaiting_decision
    ON assessment.evaluations (criterion_id) WHERE decided_at IS NULL;


-- ==========================================================================
-- learning — what students demonstrated, and what follows
-- ==========================================================================

CREATE TABLE IF NOT EXISTS learning.evidence (
    id            UUID PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    student_code  TEXT NOT NULL,
    course_run_id UUID NOT NULL REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    source_type   TEXT NOT NULL,
    source_code   TEXT NOT NULL,
    outcome_id    UUID REFERENCES academic.learning_outcomes(id) ON DELETE RESTRICT,
    capability_id UUID REFERENCES academic.capabilities(id) ON DELETE RESTRICT,
    concept_id    UUID REFERENCES academic.concepts(id) ON DELETE RESTRICT,
    demonstrated_level INTEGER CHECK (demonstrated_level IS NULL OR demonstrated_level >= 0),
    confidence    NUMERIC(4, 3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    verified_by   TEXT,
    recorded_at   TIMESTAMPTZ,
    provenance    JSONB,
    extensions    JSONB NOT NULL DEFAULT '{}',
    -- Evidence that names nothing is not evidence.
    CONSTRAINT evidence_names_a_target CHECK (
        outcome_id IS NOT NULL OR capability_id IS NOT NULL OR concept_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS evidence_by_student ON learning.evidence (student_code, course_run_id);

-- Derived estimates. Both of these are recomputed from evidence and may move in
-- either direction; neither is a fact about a student.
CREATE TABLE IF NOT EXISTS learning.concept_states (
    student_code    TEXT NOT NULL,
    concept_id      UUID NOT NULL REFERENCES academic.concepts(id) ON DELETE CASCADE,
    course_run_id   UUID NOT NULL REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    state           TEXT NOT NULL DEFAULT 'not_observed'
                    CHECK (state IN ('not_observed', 'introduced', 'developing',
                                     'demonstrated', 'consistently_demonstrated',
                                     'needs_review')),
    mastery_estimate NUMERIC(4, 3),
    evidence_codes  TEXT[] NOT NULL DEFAULT '{}',
    last_updated_at TIMESTAMPTZ,
    provenance      JSONB,
    extensions      JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (student_code, concept_id, course_run_id)
);

-- Capability states are deliberately not scoped to a run: a capability is the
-- thing a transcript cannot express, and its evidence arrives from several
-- courses over several years. `source_count` is the honest confidence signal.
CREATE TABLE IF NOT EXISTS learning.capability_states (
    student_code    TEXT NOT NULL,
    capability_id   UUID NOT NULL REFERENCES academic.capabilities(id) ON DELETE CASCADE,
    course_run_id   UUID REFERENCES delivery.course_versions(id) ON DELETE SET NULL,
    level           INTEGER CHECK (level IS NULL OR level >= 0),
    source_count    INTEGER NOT NULL DEFAULT 0 CHECK (source_count >= 0),
    evidence_codes  TEXT[] NOT NULL DEFAULT '{}',
    confidence      NUMERIC(4, 3),
    verified_by     TEXT,
    last_updated_at TIMESTAMPTZ,
    provenance      JSONB,
    extensions      JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (student_code, capability_id)
);

-- A signal with no evidence is an unexplained label, and the model does not
-- support producing those.
CREATE TABLE IF NOT EXISTS learning.signals (
    id             UUID PRIMARY KEY,
    code           TEXT NOT NULL UNIQUE,
    student_code   TEXT,
    course_run_id  UUID NOT NULL REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    signal_type    TEXT NOT NULL,
    severity       TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    description    TEXT NOT NULL,
    evidence_codes TEXT[] NOT NULL DEFAULT '{}',
    status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
    detected_at    TIMESTAMPTZ,
    provenance     JSONB,
    extensions     JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT signals_carry_evidence CHECK (cardinality(evidence_codes) > 0)
);

CREATE TABLE IF NOT EXISTS learning.signal_concepts (
    signal_id  UUID NOT NULL REFERENCES learning.signals(id) ON DELETE CASCADE,
    concept_id UUID NOT NULL REFERENCES academic.concepts(id) ON DELETE CASCADE,
    PRIMARY KEY (signal_id, concept_id)
);

CREATE TABLE IF NOT EXISTS learning.interventions (
    id                 UUID PRIMARY KEY,
    code               TEXT NOT NULL UNIQUE,
    signal_id          UUID REFERENCES learning.signals(id) ON DELETE SET NULL,
    student_code       TEXT,
    course_run_id      UUID NOT NULL REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    intervention_type  TEXT NOT NULL,
    description        TEXT NOT NULL,
    proposed_by        TEXT,
    approved_by        TEXT,
    status             TEXT NOT NULL DEFAULT 'proposed'
                       CHECK (status IN
                              ('proposed', 'approved', 'scheduled', 'completed', 'cancelled')),
    scheduled_at       TIMESTAMPTZ,
    completed_at       TIMESTAMPTZ,
    effectiveness_note TEXT,
    extensions         JSONB NOT NULL DEFAULT '{}',
    -- An intervention cannot be acted on until a person approved it.
    CONSTRAINT interventions_are_approved_by_a_person CHECK (
        status NOT IN ('approved', 'scheduled', 'completed') OR approved_by IS NOT NULL
    )
);


-- ==========================================================================
-- harness — how the exoskeleton reacts and what it asks of the professor
-- ==========================================================================

CREATE TABLE IF NOT EXISTS learning.events (
    id            UUID PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    event_type    TEXT NOT NULL,
    course_run_id UUID NOT NULL REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    entity_type   TEXT,
    entity_code   TEXT,
    occurred_at   TIMESTAMPTZ NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}',
    extensions    JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS events_by_run_time ON learning.events (course_run_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS learning.action_items (
    id                UUID PRIMARY KEY,
    code              TEXT NOT NULL UNIQUE,
    course_run_id     UUID NOT NULL REFERENCES delivery.course_versions(id) ON DELETE CASCADE,
    assigned_to       UUID NOT NULL REFERENCES delivery.users(id) ON DELETE RESTRICT,
    action_type       TEXT NOT NULL,
    title             TEXT NOT NULL,
    description       TEXT,
    priority          TEXT NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    source_event_id   UUID REFERENCES learning.events(id) ON DELETE SET NULL,
    source_codes      TEXT[] NOT NULL DEFAULT '{}',
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_progress', 'done', 'dismissed')),
    due_at            TIMESTAMPTZ,
    available_actions TEXT[] NOT NULL DEFAULT '{}',
    provenance        JSONB,
    extensions        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS action_items_pending
    ON learning.action_items (assigned_to, priority) WHERE status = 'pending';


-- ========================================================================
-- read model — the storage-neutral CourseBundle consumed by the engine
-- ========================================================================

-- This is a projection, not a second authority. The import transaction writes
-- it after the relational rows, and backend write transactions must refresh it
-- before commit. Keeping the read boundary as one versioned JSON document lets
-- the same engine consume YAML and PostgreSQL without reconstructing thirty
-- tables inside every MCP request.
CREATE TABLE IF NOT EXISTS content.course_bundle_read_models (
    course_code    TEXT PRIMARY KEY REFERENCES academic.courses(code) ON DELETE CASCADE,
    format_version TEXT NOT NULL,
    payload        JSONB NOT NULL,
    CHECK (payload ->> 'format' = 'ainar.course-bundle'),
    CHECK (payload ->> 'course_id' = course_code),
    CHECK (payload ->> 'format_version' = format_version)
);

-- The application connects with a non-owner database role. Its transaction
-- sets `ainar.user_id` only after resolving a verified OAuth issuer/subject.
-- Import/migration owners bypass RLS so they can refresh projections.
ALTER TABLE content.course_bundle_read_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_bundle_staff_read ON content.course_bundle_read_models;
CREATE POLICY course_bundle_staff_read
    ON content.course_bundle_read_models
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
              FROM academic.courses AS course
              JOIN delivery.course_versions AS run ON run.course_id = course.id
              JOIN delivery.run_staff AS staff ON staff.course_run_id = run.id
             WHERE course.code = course_bundle_read_models.course_code
               AND staff.user_id = NULLIF(current_setting('ainar.user_id', true), '')::UUID
        )
    );
