# Runner Strength Training Roadmap

## Goal
Add a first-class **Strength** experience alongside the existing **Running** dashboard. Build web first, then native iOS parity.

Use the PPSA Sport Strength plan as a representative validation case because it contains recurring workout structures, percentage-based lifting, supersets, warmups, conditioning, and progressive day-to-day variations.

---

## Product Principles
- [x] Running and Strength are separate but parallel training views
- [x] Keep the existing Running dashboard intact
- [x] Add an easy Running / Strength switch
- [ ] Separate planned prescription from actual execution
- [ ] Make workouts highly reusable through copy/move/template operations
- [ ] Never copy completed execution data into a duplicated session by default
- [ ] Calculate percentage-based target weights automatically
- [ ] Preserve historical prescriptions if maxes change later
- [ ] Support both structured plans and ad-hoc strength sessions
- [ ] Ship web first, then iOS parity

---

# Milestone 1 — Strength Domain + API
## Goal
Create the backend foundation.

### Domain
- [x] StrengthMax
- [x] Exercise
- [x] StrengthSession
- [x] ExerciseBlock
- [x] PlannedSet
- [x] ActualSet
- [x] StrengthTemplate

### StrengthMax
Suggested fields:
- [x] id
- [x] user_id
- [x] exercise_key
- [x] value
- [x] unit
- [x] effective_date

### Exercise
Suggested fields:
- [x] id
- [x] user_id or system/global owner
- [x] name
- [x] category
- [x] default_max_source
- [x] is_custom

### StrengthSession
Suggested fields:
- [x] id
- [x] user_id
- [x] date
- [x] title
- [x] notes
- [x] actual-set completion; session status remains derived
- [x] ordered exercise blocks

### ExerciseBlock
Suggested fields:
- [x] id
- [x] parent session is implicit in the nested document
- [x] exercise_id
- [x] order
- [x] optional group_id for supersets
- [x] optional label such as A1 / A2 / B1

### PlannedSet
Suggested fields:
- [x] id
- [x] parent exercise block is implicit in the nested document
- [x] set_number
- [x] optional target_reps
- [x] optional target_distance and yards/meters unit
- [x] optional target_duration_seconds
- [x] optional percentage
- [x] optional max_source
- [x] optional max_value_at_creation
- [x] optional target_weight
- [x] optional rest_seconds

### ActualSet
Suggested fields:
- [x] planned_set_id
- [x] actual_reps
- [x] actual_distance
- [x] actual_duration_seconds
- [x] actual_weight
- [x] completed
- [x] optional notes

### StrengthTemplate
Suggested fields:
- [x] id
- [x] user_id
- [x] name
- [x] exercise blocks
- [x] superset groups
- [x] prescribed sets

### Minimum API
#### Maxes
- [x] GET /api/strength/maxes
- [x] PUT /api/strength/maxes/{exercise_key}

#### Exercises
- [x] GET /api/strength/exercises
- [x] POST /api/strength/exercises

#### Sessions
- [x] GET /api/strength/weeks/{day}
- [x] GET /api/strength/sessions/{session_id}
- [x] POST /api/strength/sessions
- [x] PATCH /api/strength/sessions/{session_id}
- [x] DELETE /api/strength/sessions/{session_id}

#### Templates
- [x] GET /api/strength/templates
- [x] POST /api/strength/templates
- [x] PATCH /api/strength/templates/{template_id}
- [x] DELETE /api/strength/templates/{template_id}

### Acceptance Criteria
- [x] Authenticated user can save/read maxes
- [x] Authenticated user can create/read/update/delete a strength session
- [x] Session preserves exercise order, superset groups, and planned/actual sets
- [x] Clerk ownership is enforced
- [x] Backend tests pass

### Milestone 1 implementation notes
- Strength uses four on-demand DynamoDB tables for max history, custom exercises,
  sessions, and templates. Sessions and templates store their ordered nested
  blocks and sets as whole documents; this preserves exact ordering without a
  single-table entity encoding.
- Built-in exercises live in the API, while only user-created exercises are
  persisted. Every user-owned read and mutation uses the verified Clerk `sub`.
- Session and template PATCH requests leave omitted fields unchanged. Explicit
  `null` clears nullable notes, and an empty `exercise_blocks` list clears the
  collection; `null` is invalid for required fields and collections.
- Planned and actual sets are separate. Templates contain prescription only,
  and nested IDs can be regenerated later when copy/template instantiation is
  implemented. Block IDs and planned-set IDs are unique within each containing
  session or template document.
- Strength V1 weights are pounds-only. Planned sets support reps, distance in
  yards or meters, and duration; actual sets store the corresponding execution.
- Templates store reusable prescriptions. Percentage templates retain only the
  percentage and max source, while fixed-weight templates may retain their
  prescribed weight. Dated sessions can freeze `max_value_at_creation` and the
  resolved `target_weight`; percentage calculation and template instantiation
  remain deferred.

---

# Milestone 2 — Maxes + Exercise Library
## Goal
Let the athlete define the source data for prescriptions.

- [x] Add Strength Settings / Maxes screen
- [x] Bench Press max
- [x] Back Squat max
- [x] Deadlift max
- [x] Power Clean max
- [x] Front Squat max
- [x] Snatch max
- [ ] Custom max source
- [x] Built-in exercise library
- [x] Custom exercises
- [x] Exercise can reference a default max source
- [x] Max updates preserve historical values

### Acceptance Criteria
- [x] All required maxes are configurable
- [x] Exercises reference the correct max source
- [x] Historical workouts remain stable when maxes change

---

# Milestone 3 — Web Strength Dashboard + Session Editor
## Goal
Build the Strength equivalent of the Running weekly dashboard.

- [ ] Add Running / Strength top-level switch
- [ ] Preserve current Running dashboard
- [ ] Add Strength weekly navigation
- [ ] Monday-Sunday selector
- [ ] Selected-day strength session
- [ ] Add new strength session
- [ ] Add exercise
- [ ] Remove exercise
- [ ] Edit title
- [ ] Reorder exercises
- [ ] Add/delete sets
- [ ] Set target reps
- [ ] Set target percentage
- [ ] Set fixed target weight
- [ ] Save/reload session

### Acceptance Criteria
- [ ] Complete daily strength workout can be authored in the web UI
- [ ] Reload preserves the saved session
- [ ] Running dashboard remains unchanged

---

# Milestone 4 — Percentage-of-Max Calculations
## Goal
Automatically resolve programmed percentages into usable weights.

- [ ] Add % of max prescription mode
- [ ] Select max source
- [ ] Calculate target weight
- [ ] Default rounding to nearest usable 5 lb increment
- [ ] Display percentage and resolved target weight together
- [ ] Store max_value_at_creation
- [ ] Store resolved target_weight
- [ ] Add calculation tests

Example with Bench Max = 265 lb:
- [ ] 50% x 5 -> about 135 lb
- [ ] 55% x 5 -> about 145 lb
- [ ] 60% x 5 -> about 160 lb
- [ ] 65% x 5 -> about 170 lb

### Acceptance Criteria
- [ ] User enters percentages instead of manually calculating weights
- [ ] Target weights are deterministic
- [ ] Old workouts do not change after max updates

---

# Milestone 5 — Execution / Actual Sets
## Goal
Turn the plan into a real training log.

- [ ] Show planned target for each set
- [ ] Record actual weight
- [ ] Record actual reps
- [ ] Mark set complete
- [ ] Allow actual performance to differ from plan
- [ ] Save partial progress
- [ ] Keep unfinished sets unfinished
- [ ] Make set completion fast with minimal taps

Example:
Planned: 170 x 5
Actual: 175 x 4

### Acceptance Criteria
- [ ] Entire workout can be executed set-by-set
- [ ] Planned and actual values remain distinct
- [ ] Refresh preserves execution state

---

# Milestone 6 — Copy / Move / Template Workflow
## Goal
Make recurring strength programs fast to manage.

### Session Operations
- [ ] Duplicate workout
- [ ] Copy workout to another date
- [ ] Move workout to another date
- [ ] Copy from previous workout
- [ ] Save session as template
- [ ] Create session from template

### Copy Rules
Copy:
- [ ] title
- [ ] exercise order
- [ ] superset grouping
- [ ] prescribed sets
- [ ] reps
- [ ] percentages
- [ ] target weights
- [ ] rest prescriptions

Do NOT copy:
- [ ] actual completed reps
- [ ] actual completed weights
- [ ] completed flags

- [ ] Copied session receives new IDs

### Exercise Operations
- [ ] Duplicate individual exercise
- [ ] Duplicate prescribed sets
- [ ] Duplicate entire superset block
- [ ] Reorder after duplication

### Acceptance Criteria
- [ ] Similar workouts can be cloned in seconds
- [ ] Only changed sets/reps/percentages/exercises need editing
- [ ] Original workout remains unchanged
- [ ] Actual execution never leaks into the copy

---

# Milestone 7 — Supersets + Reordering
## Goal
Support real gym execution where exercises are grouped/rearranged.

- [ ] Drag/reorder exercises
- [ ] Group exercises as superset
- [ ] Ungroup superset
- [ ] Reorder within superset
- [ ] Reorder entire superset block
- [ ] Display A1 / A2 / A3 style labels
- [ ] Persist group ordering
- [ ] Duplicate whole superset block
- [ ] Keep actual-set tracking per exercise

### Acceptance Criteria
- [ ] Normal sequence can be converted into a superset without rebuilding
- [ ] Superset structure survives reload
- [ ] Execution remains easy to follow

---

# Milestone 8 — Web Strength V1 Completion
## Goal
Make Strength usable for daily training on web.

- [ ] Running / Strength navigation polished
- [ ] Weekly navigation polished
- [ ] Maxes polished
- [ ] Session editor polished
- [ ] Percentage calculations polished
- [ ] Actual set entry polished
- [ ] Copy/move/template UX polished
- [ ] Superset grouping polished
- [ ] Error/loading states
- [ ] Empty states
- [ ] API tests green
- [ ] Web tests green
- [ ] Production manual validation

### Acceptance Criteria
- [ ] Plan, execute, modify, copy, and review strength workouts entirely on web

---

# Milestone 9 — PPSA Validation
## Goal
Use the PPSA Sport Strength program as a real-world validation case.

- [ ] Recreate Day 1 without notes hacks
- [ ] Recreate a later session with different percentages
- [ ] Recreate a session with supersets
- [ ] Recreate fixed-rep accessory work
- [ ] Verify the correct max source for each percentage-based lift
- [ ] Verify duplicate/edit workflow makes later days fast to create
- [ ] Confirm sets/reps/percentages/exercise differences fit the model
- [ ] Document any model limitation discovered

### Acceptance Criteria
- [ ] Representative PPSA sessions fit structured fields
- [ ] No core program behavior depends on free-text notes

---

# Milestone 10 — Native iOS Strength Domain + Networking
## Goal
Bring the Strength backend into the native app.

- [ ] Swift strength domain models
- [ ] Strength DTOs
- [ ] Strength repository abstraction
- [ ] API repository
- [ ] Reuse authenticated APIClient
- [ ] Deterministic repository/networking tests
- [ ] In-memory previews/tests where useful

### Acceptance Criteria
- [ ] iOS can load real strength week/session/max/template data

---

# Milestone 11 — Native iOS Strength UI
## Goal
Reach practical feature parity with web.

- [ ] Running / Strength switch
- [ ] Strength week navigation
- [ ] Selected-day session
- [ ] Maxes
- [ ] Exercise library
- [ ] Add/edit/delete exercises
- [ ] Planned sets
- [ ] Percentage calculations
- [ ] Actual set entry
- [ ] Set completion
- [ ] Reordering
- [ ] Superset grouping
- [ ] Duplicate workout
- [ ] Copy workout
- [ ] Move workout
- [ ] Templates
- [ ] Loading/error UX
- [ ] Physical-device testing

### Acceptance Criteria
- [ ] Core Strength workflows work on physical iPhone
- [ ] Web and iOS show the same backend-authoritative data

---

# Milestone 12 — Cross-Client Validation
- [ ] Create on web -> appears on iOS
- [ ] Edit on iOS -> appears on web
- [ ] Complete sets on iOS -> web reflects actuals
- [ ] Update max -> both clients agree
- [ ] Duplicate on web -> iOS sees clone
- [ ] Move on iOS -> web reflects new date
- [ ] Superset changes remain consistent
- [ ] Templates work across clients

---

# Deferred Beyond Initial Strength Release
- [ ] RPE / RIR
- [ ] Estimated 1RM trends
- [ ] Volume analytics
- [ ] PR detection
- [ ] Automatic progressive overload
- [ ] Fatigue/readiness modeling
- [ ] Rest timer
- [ ] Apple Watch strength tracking
- [ ] Heart-rate integration
- [ ] Bar velocity
- [ ] Video/form analysis
- [ ] AI-generated training plans

---

# Suggested Branch Flow

## 1. feat/strength-domain
- [ ] domain
- [ ] API
- [ ] persistence
- [ ] tests

## 2. feat/strength-maxes-library
- [ ] maxes
- [ ] exercise library

## 3. feat/web-strength-dashboard
- [ ] dashboard
- [ ] session editor
- [ ] percentages

## 4. feat/strength-execution
- [ ] actual sets
- [ ] completion

## 5. feat/strength-workflow
- [ ] copy
- [ ] move
- [ ] templates
- [ ] supersets
- [ ] reorder

## 6. feat/ios-strength
- [ ] iOS domain/networking
- [ ] iOS UI
- [ ] parity

For every branch:
- [ ] Small commits
- [ ] Push
- [ ] PR
- [ ] CI green
- [ ] Review
- [ ] Squash merge

---

# Definition of Done
- [ ] Running and Strength can be switched easily
- [ ] Maxes are configurable
- [ ] Exercise library works
- [ ] Daily strength sessions can be planned
- [ ] Percentage weights calculate automatically
- [ ] Planned vs actual performance is preserved
- [ ] Sets can be marked complete
- [ ] Exercises can be reordered
- [ ] Supersets can be created/edited
- [ ] Workouts can be duplicated
- [ ] Workouts can be copied to another date
- [ ] Workouts can be moved to another date
- [ ] Sessions can be saved as templates
- [ ] Similar workouts can be created quickly by cloning + editing
- [ ] Representative PPSA sessions fit the structured model
- [ ] Web implementation is production usable
- [ ] iOS implementation reaches parity
- [ ] Cross-client sync is verified
- [ ] Automated tests and CI are green
