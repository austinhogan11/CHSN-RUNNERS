# Runner V1.3 — GPS Run Recording Roadmap

## Goal
Build native GPS run recording that:
- [ ] Starts a run from Runner iOS
- [ ] Shows live position on Apple Maps
- [ ] Draws a route trail
- [ ] Tracks distance, duration, average pace, current pace, elevation, elevation gain
- [ ] Supports pause/resume/finish
- [ ] Continues in background / with phone locked
- [ ] Saves the completed activity
- [ ] Automatically updates the training log

## Architecture Rules
- [ ] Keep `Workout` as the training-log/planning object
- [ ] Add `Activity` as the recorded physical activity object
- [ ] Link Activity to Workout with optional `workout_id`
- [ ] iOS talks only to the Runner API, never directly to DynamoDB
- [ ] Record GPS locally while running
- [ ] Do not stream every GPS point to AWS
- [ ] Upload after finish
- [ ] Checkpoint active runs locally for crash/process recovery
- [ ] Design Activity so Watch/HealthKit/heart-rate can be added later

# Milestone 1 — Activity Domain + Backend
- [ ] Inspect current Workout/API/DynamoDB design
- [ ] Add Activity model
- [ ] Include id, user_id, optional workout_id, source, started_at, ended_at, elapsed_seconds, moving_seconds, distance_meters, elevation_gain_meters, route reference
- [ ] Define route points: lat, lon, timestamp, altitude, horizontal accuracy
- [ ] Store Activity metadata in DynamoDB
- [ ] Store route payload in S3
- [ ] Add `POST /api/activities`
- [ ] Add `GET /api/activities/{activity_id}`
- [ ] Enforce Clerk auth + ownership
- [ ] Add backend tests

**Done when**
- [ ] Completed Activity can be stored and read
- [ ] Activity belongs to authenticated user
- [ ] Activity can optionally link to a Workout

# Milestone 2 — RunRecorder Core
- [ ] Add Core Location
- [ ] Create `RunRecorder`
- [ ] States: idle, recording, paused, finishing, finished
- [ ] Track start time, elapsed time, accepted GPS points, distance, pace, altitude, elevation gain
- [ ] Implement pause/resume
- [ ] Ignore distance while paused
- [ ] Filter poor/stale/duplicate GPS samples
- [ ] Reject impossible jumps
- [ ] Add unit tests for state, distance, pace, and filtering

**Done when**
- [ ] Recorder produces a plausible in-memory Activity
- [ ] Pause/resume works correctly
- [ ] GPS noise does not obviously inflate distance

# Milestone 3 — Live Map + Run UI
- [ ] Add Start Run entry point
- [ ] Build SwiftUI + MapKit recording screen
- [ ] Show current user position
- [ ] Draw growing route polyline/trail
- [ ] Show distance
- [ ] Show elapsed time
- [ ] Show average pace
- [ ] Show current pace if reliable
- [ ] Show elevation gain
- [ ] Add Pause / Resume / Finish
- [ ] Add finish confirmation
- [ ] Prevent duplicate finish actions

**Done when**
- [ ] User can record a foreground run end-to-end
- [ ] Route and metrics update live

# Milestone 4 — Background / Locked Screen
- [ ] Add location permission descriptions
- [ ] Enable Background Modes → Location updates
- [ ] Use the appropriate modern Core Location background session
- [ ] Verify background app recording
- [ ] Verify locked-screen recording
- [ ] Verify switching apps does not stop the run
- [ ] Restore current state when returning foreground
- [ ] Tune for battery-conscious operation

**Done when**
- [ ] Locked-screen/background distance and route are preserved reliably

# Milestone 5 — Active Run Recovery
- [ ] Add `ActiveRunSnapshot`
- [ ] Persist active session locally
- [ ] Save session ID, started time, state, route points, distance, elapsed time
- [ ] Checkpoint periodically
- [ ] Recover unfinished session on app launch
- [ ] Offer Resume unfinished run / Discard
- [ ] Clear checkpoint after successful finish/upload

**Done when**
- [ ] App termination/relaunch does not automatically lose the run

# Milestone 6 — Activity → Training Log
## Planned Workout
- [ ] Start a run from an existing Workout
- [ ] Carry workout_id into Activity
- [ ] On finish, update Workout execution from Activity
- [ ] Refresh week, trend, and weekly totals

## Unplanned Run
- [ ] Start Run without a Workout
- [ ] Upload Activity
- [ ] Automatically create a Workout
- [ ] Populate distance, duration, start time
- [ ] Use sensible default title such as `Run`

**Done when**
- [ ] GPS runs require no manual re-entry
- [ ] Planned workouts can be completed by a recorded Activity
- [ ] Unplanned runs create training-log entries automatically

# Milestone 7 — Outdoor Validation + Hardening
- [ ] Short sanity walk/run
- [ ] ~1 mile run
- [ ] 5K run
- [ ] Longer run
- [ ] Hilly run
- [ ] Stoplight / pause-resume test
- [ ] Mostly locked-screen run
- [ ] Compare against Garmin/Strava/known route
- [ ] Tune GPS filters
- [ ] Tune elevation smoothing
- [ ] Check stationary drift
- [ ] Check battery usage
- [ ] Check GPS degradation behavior
- [ ] Check finish with network unavailable
- [ ] Support later upload retry if immediate upload fails

**Done when**
- [ ] Distance is consistently close to trusted reference data
- [ ] Route looks plausible
- [ ] Background recording is reliable
- [ ] Pause/resume is trustworthy
- [ ] Failed upload does not lose the Activity

# Deferred Beyond V1.3
- [ ] Apple Watch recording
- [ ] Bluetooth heart-rate monitors
- [ ] HealthKit import/export
- [ ] Heart-rate sample storage
- [ ] Cadence
- [ ] Running power
- [ ] Strava/Garmin integrations
- [ ] Live location sharing
- [ ] Audio coaching
- [ ] Structured interval execution
- [ ] Segments
- [ ] Advanced route planning
- [ ] Android
- [ ] Full offline multi-device sync

# Suggested Branch Flow
- [ ] `feat/gps-activity-domain`
- [ ] `feat/ios-run-recorder`
- [ ] `feat/ios-run-map`
- [ ] `feat/ios-run-background`
- [ ] `feat/activity-workout-integration`
- [ ] `feat/gps-hardening`

For each branch:
- [ ] Small commits
- [ ] Push
- [ ] PR
- [ ] CI green
- [ ] Review
- [ ] Squash merge

# V1.3 Definition of Done
- [ ] Start a run on iPhone
- [ ] Show live map position
- [ ] Draw route trail
- [ ] Track GPS distance
- [ ] Track duration
- [ ] Calculate average pace
- [ ] Track elevation gain
- [ ] Pause/resume
- [ ] Finish safely
- [ ] Continue while backgrounded / locked
- [ ] Recover active run after interruption
- [ ] Upload completed Activity
- [ ] Link to or create Workout
- [ ] Update training log automatically
- [ ] Update weekly totals and mileage trend
- [ ] Complete real outdoor validation
- [ ] Automated tests and iOS CI green

## Guiding Principle
> `Workout` is the training plan/log object.  
> `Activity` is the recorded evidence of what the athlete actually did.
