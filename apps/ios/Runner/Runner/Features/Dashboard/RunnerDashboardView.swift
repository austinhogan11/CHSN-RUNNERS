import Charts
import SwiftUI

struct RunnerDashboardView: View {
    @State private var state = DashboardState.mock()
    @State private var editorContext: WorkoutEditorContext?
    @State private var workoutPendingDeletion: Workout?

    var body: some View {
        ZStack {
            RunnerTheme.background
                .ignoresSafeArea()

            ScrollView(.vertical) {
                LazyVStack(spacing: 20) {
                    RunnerHeaderView()
                    MileageTrendView(points: state.trend)
                    WeekOverviewView(state: state)
                    SelectedDayView(
                        date: state.selectedDate,
                        workouts: state.selectedDayWorkouts,
                        addWorkout: {
                            editorContext = WorkoutEditorContext(date: state.selectedDate)
                        },
                        editWorkout: { workout in
                            editorContext = WorkoutEditorContext(date: workout.date, workout: workout)
                        },
                        deleteWorkout: { workoutPendingDeletion = $0 }
                    )
                    WeeklyMileageSummaryView(summary: state.displayedWeek)
                }
                .padding(.horizontal, 16)
                .safeAreaPadding(.top, 8)
                .safeAreaPadding(.bottom, 28)
            }
            .scrollIndicators(.hidden)
        }
        .preferredColorScheme(.dark)
        .sheet(item: $editorContext) { context in
            WorkoutEditorView(context: context) { input in
                if let workout = context.workout {
                    state.updateWorkout(id: workout.id, with: input)
                } else {
                    state.createWorkout(input)
                }
            }
        }
        .alert(
            "Delete workout?",
            isPresented: Binding(
                get: { workoutPendingDeletion != nil },
                set: { isPresented in
                    if !isPresented { workoutPendingDeletion = nil }
                }
            ),
            presenting: workoutPendingDeletion
        ) { workout in
            Button("Delete", role: .destructive) {
                state.deleteWorkout(id: workout.id)
                workoutPendingDeletion = nil
            }
            Button("Cancel", role: .cancel) {
                workoutPendingDeletion = nil
            }
        } message: { workout in
            Text("Delete “\(workout.title)”? This only affects local data.")
        }
    }
}

private struct RunnerHeaderView: View {
    var body: some View {
        HStack(spacing: 12) {
            Text("R")
                .font(.title2.bold().italic())
                .foregroundStyle(RunnerTheme.background)
                .frame(width: 40, height: 40)
                .background(RunnerTheme.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

            Text("Runner")
                .font(.title2.bold())

            Spacer()
        }
        .accessibilityElement(children: .combine)
    }
}

private struct MileageTrendView: View {
    let points: [MileageTrendPoint]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline) {
                Text("Weekly mileage")
                    .font(.headline)

                Spacer()

                if let latest = points.last {
                    Text(latest.actualMileage, format: .number.precision(.fractionLength(1)))
                        .font(.title3.bold())
                        .foregroundStyle(RunnerTheme.accent)
                    Text("MI")
                        .font(.caption2.bold())
                        .foregroundStyle(RunnerTheme.mutedText)
                }
            }

            Chart(points) { point in
                AreaMark(
                    x: .value("Week", point.weekStart),
                    y: .value("Actual mileage", point.actualMileage)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [RunnerTheme.accent.opacity(0.28), RunnerTheme.accent.opacity(0.01)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

                LineMark(
                    x: .value("Week", point.weekStart),
                    y: .value("Actual mileage", point.actualMileage)
                )
                .foregroundStyle(RunnerTheme.accent)
                .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))

                PointMark(
                    x: .value("Week", point.weekStart),
                    y: .value("Actual mileage", point.actualMileage)
                )
                .foregroundStyle(RunnerTheme.accent)
                .symbolSize(24)
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .weekOfYear, count: 2)) { value in
                    AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                        .foregroundStyle(RunnerTheme.mutedText)
                    AxisTick().foregroundStyle(RunnerTheme.border)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine().foregroundStyle(RunnerTheme.border)
                    AxisValueLabel {
                        if let mileage = value.as(Double.self) {
                            Text(mileage, format: .number.precision(.fractionLength(0)))
                                .foregroundStyle(RunnerTheme.mutedText)
                        }
                    }
                }
            }
            .frame(minHeight: 170, idealHeight: 190)
            .accessibilityLabel("Actual weekly mileage trend")
        }
        .runnerCard()
    }
}

private struct WeekOverviewView: View {
    @Bindable var state: DashboardState

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Button("Previous week", systemImage: "chevron.left") {
                    state.showPreviousWeek()
                }
                .labelStyle(.iconOnly)

                Spacer()

                VStack(spacing: 3) {
                    HStack(spacing: 6) {
                        Text(state.displayedWeekStart, format: .dateTime.month(.wide).day())
                        Text("–")
                            .foregroundStyle(RunnerTheme.mutedText)
                        if let weekEnd = state.weekDates.last {
                            Text(weekEnd, format: .dateTime.month(.abbreviated).day())
                        }
                    }
                    .font(.headline)

                    if !state.isViewingCurrentWeek {
                        Button("Current week") {
                            state.showCurrentWeek()
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(RunnerTheme.accent)
                    }
                }

                Spacer()

                Button("Next week", systemImage: "chevron.right") {
                    state.showNextWeek()
                }
                .labelStyle(.iconOnly)
            }
            .buttonStyle(.plain)
            .foregroundStyle(RunnerTheme.accent)
            .frame(minHeight: 44)

            HStack(spacing: 5) {
                ForEach(state.weekDates, id: \.self) { date in
                    WeekdayButton(
                        date: date,
                        mileage: state.displayedWeek.actualMileage(on: date),
                        isSelected: Calendar.runner.isDate(date, inSameDayAs: state.selectedDate),
                        select: { state.selectedDate = date }
                    )
                }
            }
        }
    }
}

private struct WeekdayButton: View {
    let date: Date
    let mileage: Double
    let isSelected: Bool
    let select: () -> Void

    var body: some View {
        Button(action: select) {
            VStack(spacing: 6) {
                Text(date, format: .dateTime.weekday(.narrow))
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(isSelected ? RunnerTheme.background : RunnerTheme.mutedText)
                Text(date, format: .dateTime.day())
                    .font(.callout.weight(.bold))
                    .foregroundStyle(isSelected ? RunnerTheme.background : .white)
                    .minimumScaleFactor(0.8)
                Circle()
                    .fill(mileage > 0 ? (isSelected ? RunnerTheme.background : RunnerTheme.accent) : .clear)
                    .frame(width: 4, height: 4)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                isSelected ? RunnerTheme.accent : RunnerTheme.surface,
                in: RoundedRectangle(cornerRadius: 13, style: .continuous)
            )
            .overlay {
                if !isSelected {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .stroke(RunnerTheme.border, lineWidth: 1)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(date.formatted(.dateTime.weekday(.wide).month().day()))
        .accessibilityValue(mileage > 0 ? "\(mileage.formatted()) miles" : "No mileage")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

private struct SelectedDayView: View {
    let date: Date
    let workouts: [Workout]
    let addWorkout: () -> Void
    let editWorkout: (Workout) -> Void
    let deleteWorkout: (Workout) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(date, format: .dateTime.weekday(.wide))
                        .font(.title3.bold())
                    Text(date, format: .dateTime.month(.wide).day())
                        .font(.caption)
                        .foregroundStyle(RunnerTheme.mutedText)
                }

                Spacer()

                let mileage = workouts.reduce(0) { $0 + ($1.distanceMiles ?? 0) }
                Text("\(mileage.formatted(.number.precision(.fractionLength(1)))) mi")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(RunnerTheme.accent)
            }

            if workouts.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "figure.run")
                        .font(.title2)
                        .foregroundStyle(RunnerTheme.mutedText)
                    Text("No workouts yet")
                        .font(.subheadline.weight(.semibold))
                    Text("An empty day stays empty until you add a real session.")
                        .font(.caption)
                        .foregroundStyle(RunnerTheme.mutedText)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(workouts) { workout in
                        WorkoutRow(
                            workout: workout,
                            edit: { editWorkout(workout) },
                            delete: { deleteWorkout(workout) }
                        )
                    }
                }
            }

            Button(action: addWorkout) {
                Label("Add workout", systemImage: "plus")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.plain)
            .foregroundStyle(RunnerTheme.accent)
            .background(RunnerTheme.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            .overlay {
                RoundedRectangle(cornerRadius: 12)
                    .stroke(RunnerTheme.accent.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [5]))
            }
        }
        .runnerCard()
    }
}

private struct WorkoutRow: View {
    let workout: Workout
    let edit: () -> Void
    let delete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(workout.title)
                        .font(.subheadline.weight(.semibold))
                    Text(workout.kind.label.uppercased())
                        .font(.caption2.weight(.bold))
                        .tracking(0.8)
                        .foregroundStyle(RunnerTheme.accent)
                }

                Spacer()

                Menu {
                    Button("Edit", systemImage: "pencil", action: edit)
                    Button("Delete", systemImage: "trash", role: .destructive, action: delete)
                } label: {
                    Image(systemName: "ellipsis")
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .foregroundStyle(RunnerTheme.mutedText)
                .accessibilityLabel("Workout actions")
            }

            if let startTime = workout.startTime {
                Label(startTime.formatted(.dateTime.hour().minute()), systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(RunnerTheme.mutedText)
            }

            HStack(spacing: 12) {
                WorkoutMetric(label: "DISTANCE", value: distanceText)
                WorkoutMetric(label: "DURATION", value: WorkoutDuration.format(workout.durationSeconds).nilIfEmpty ?? "—")
                WorkoutMetric(label: "PACE", value: paceText)
            }
        }
        .padding(14)
        .background(RunnerTheme.elevatedSurface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var distanceText: String {
        guard let distance = workout.distanceMiles else { return "—" }
        return "\(distance.formatted(.number.precision(.fractionLength(1)))) mi"
    }

    private var paceText: String {
        guard let pace = workout.paceSecondsPerMile else { return "—" }
        return String(format: "%d:%02d", pace / 60, pace % 60)
    }
}

private struct WorkoutMetric: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(RunnerTheme.mutedText)
            Text(value)
                .font(.caption.weight(.semibold))
                .monospacedDigit()
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct WeeklyMileageSummaryView: View {
    let summary: WeekSummary

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Weekly actual")
                    .font(.subheadline.weight(.semibold))
                Text("Completed distance across all sessions")
                    .font(.caption)
                    .foregroundStyle(RunnerTheme.mutedText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 0) {
                Text(summary.actualMileage, format: .number.precision(.fractionLength(1)))
                    .font(.title.bold())
                    .foregroundStyle(RunnerTheme.accent)
                    .monospacedDigit()
                Text("MILES")
                    .font(.caption2.weight(.bold))
                    .tracking(1)
                    .foregroundStyle(RunnerTheme.mutedText)
            }
        }
        .runnerCard()
    }
}

private struct WorkoutEditorContext: Identifiable {
    let id = UUID()
    let date: Date
    let workout: Workout?

    init(date: Date, workout: Workout? = nil) {
        self.date = date
        self.workout = workout
    }
}

private struct WorkoutEditorView: View {
    @Environment(\.dismiss) private var dismiss
    let context: WorkoutEditorContext
    let save: (WorkoutInput) -> Void

    @State private var title: String
    @State private var distance: String
    @State private var duration: String
    @State private var startTime: Date
    @State private var includesStartTime: Bool
    @State private var validationMessage: String?

    init(context: WorkoutEditorContext, save: @escaping (WorkoutInput) -> Void) {
        self.context = context
        self.save = save
        let workout = context.workout
        _title = State(initialValue: workout?.title ?? "")
        _distance = State(initialValue: workout?.distanceMiles.map { $0.formatted() } ?? "")
        _duration = State(initialValue: WorkoutDuration.format(workout?.durationSeconds))
        _startTime = State(initialValue: workout?.startTime ?? context.date)
        _includesStartTime = State(initialValue: workout == nil || workout?.startTime != nil)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Workout") {
                    LabeledContent("Date") {
                        Text(context.date, format: .dateTime.weekday(.abbreviated).month().day())
                    }
                    TextField("Title", text: $title)
                        .textInputAutocapitalization(.sentences)
                }

                Section("Actual execution") {
                    TextField("Distance in miles", text: $distance)
                        .keyboardType(.decimalPad)
                    TextField("Duration (MM:SS or HH:MM:SS)", text: $duration)
                        .keyboardType(.numbersAndPunctuation)
                    Toggle("Start time", isOn: $includesStartTime)
                    if includesStartTime {
                        DatePicker("Time", selection: $startTime, displayedComponents: .hourAndMinute)
                    }
                }

                Section {
                    LabeledContent("Pace") {
                        Text(derivedPace)
                            .monospacedDigit()
                    }
                } footer: {
                    Text("Pace is calculated from duration and positive distance.")
                }

                if let validationMessage {
                    Section {
                        Text(validationMessage)
                            .foregroundStyle(RunnerTheme.crimson)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(RunnerTheme.background)
            .navigationTitle(context.workout == nil ? "Add workout" : "Edit workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { saveWorkout() }
                        .fontWeight(.semibold)
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationDetents([.medium, .large])
    }

    private var derivedPace: String {
        guard let parsedDistance = Double(distance), parsedDistance > 0,
              let parsedDuration = WorkoutDuration.parse(duration)
        else {
            return "—"
        }
        let pace = Int((Double(parsedDuration) / parsedDistance).rounded())
        return String(format: "%d:%02d /mi", pace / 60, pace % 60)
    }

    private func saveWorkout() {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else {
            validationMessage = "Enter a workout title."
            return
        }

        let parsedDistance: Double?
        if distance.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            parsedDistance = nil
        } else if let value = Double(distance), value > 0 {
            parsedDistance = value
        } else {
            validationMessage = "Distance must be a positive number."
            return
        }

        let trimmedDuration = duration.trimmingCharacters(in: .whitespacesAndNewlines)
        let parsedDuration = WorkoutDuration.parse(trimmedDuration)
        if !trimmedDuration.isEmpty && parsedDuration == nil {
            validationMessage = "Use MM:SS or HH:MM:SS for duration."
            return
        }

        save(
            WorkoutInput(
                date: context.date,
                title: trimmedTitle,
                distanceMiles: parsedDistance,
                durationSeconds: parsedDuration,
                startTime: includesStartTime ? startTime : nil
            )
        )
        dismiss()
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}

#Preview {
    RunnerDashboardView()
}
