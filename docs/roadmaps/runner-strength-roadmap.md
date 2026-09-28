# Runner Strength Training Roadmap

## Goal
Add a first-class **Strength** experience alongside the existing **Running** dashboard. Build web first, then native iOS parity.

Use the PPSA Sport Strength plan as a representative validation case because it contains recurring workout structures, percentage-based lifting, supersets, warmups, conditioning, and progressive day-to-day variations.

---

## Product Principles
- [ ] Running and Strength are separate but parallel training views
- [ ] Keep the existing Running dashboard intact
- [ ] Add an easy Running / Strength switch
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
- [ ] StrengthMax
- [ ] Exercise
- [ ] StrengthSession
- [ ] ExerciseBlock
- [ ] PlannedSet
- [ ] ActualSet
- [ ] StrengthTemplate

### StrengthMax
Suggested fields:
- [ ] id
- [ ] user_id
- [ ] exercise_key
- [ ] value
- [ ] unit
- [ ] effective_date

### Exercise
Suggested fields:
- [ ] id
- [ ] user_id or system/global owner
- [ ] name
- [ ] category
- [ ] default_max_source
- [ ] is_custom

### StrengthSession
Suggested fields:
- [ ] id
- [ ] user_id
- [ ] date
- [ ] title
- [ ] notes
- [ ] completed
- [ ] ordered exercise blocks

### ExerciseBlock
Suggested fields:
- [ ] id
- [ ] session_id
- [ ] exercise_id
- [ ] order
- [ ] optional group_id for supersets
- [ ] optional label such as A1 / A2 / B1

### PlannedSet
Suggested fields:
- [ ] id
- [ ] exercise_block_id
- [ ] set_number
- [ ] target_reps
- [ ] optional percentage
- [ ] optional max_source
- [ ] optional max_value_at_creation
- [ ] optional target_weight
- [ ] optional rest_seconds

### ActualSet
Suggested fields:
- [ ] planned_set_id
- [ ] actual_reps
- [ ] actual_weight
- [ ] completed
- [ ] optional notes

### StrengthTemplate
Suggested fields:
- [ ] id
- [ ] user_id
- [ ] name
- [ ] exercise blocks
- [ ] superset groups
- [ ] prescribed sets

### Minimum API
#### Maxes
- [ ] GET /api/strength/maxes
- [ ] PUT /api/strength/maxes/{exercise_key}

#### Exercises
- [ ] GET /api/strength/exercises
- [ ] POST /api/strength/exercises

#### Sessions
- [ ] GET /api/strength/weeks/{day}
- [ ] GET /api/strength/sessions/{session_id}
- [ ] POST /api/strength/sessions
- [ ] PATCH /api/strength/sessions/{session_id}
- [ ] DELETE /api/strength/sessions/{session_id}

#### Templates
- [ ] GET /api/strength/templates
- [ ] POST /api/strength/templates
- [ ] PATCH /api/strength/templates/{template_id}
- [ ] DELETE /api/strength/templates/{template_id}

### Acceptance Criteria
- [ ] Authenticated user can save/read maxes
- [ ] Authenticated user can create/read/update/delete a strength session
- [ ] Session preserves exercise order, superset groups, and planned/actual sets
- [ ] Clerk ownership is enforced
- [ ] Backend tests pass

---

# Milestone 2 — Maxes + Exercise Library
## Goal
Let the athlete define the source data for prescriptions.

- [ ] Add Strength Settings / Maxes screen
- [ ] Bench Press max
- [ ] Back Squat max
- [ ] Deadlift max
- [ ] Power Clean max
- [ ] Front Squat max
- [ ] Snatch max
- [ ] Custom max source
- [ ] Built-in exercise library
- [ ] Custom exercises
- [ ] Exercise can reference a default max source
- [ ] Max updates preserve historical values

### Acceptance Criteria
- [ ] All required maxes are configurable
- [ ] Exercises reference the correct max source
- [ ] Historical workouts remain stable when maxes change

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
