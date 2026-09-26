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
                    MileageTrendView(state: state)
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
    @Bindable var state: DashboardState

    private var points: [MileageTrendPoint] {
        state.visibleTrend
    }

    private var axisScale: MileageAxisScale {
        state.visibleTrendAxisScale
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Weekly mileage")
                    .font(.headline)

                Spacer()

                Button("Older mileage", systemImage: "chevron.left") {
                    withAnimation(.snappy) {
                        state.browseTrendBackward()
                    }
                }
                .labelStyle(.iconOnly)
                .disabled(!state.canBrowseOlderTrend)

                Button("Newer mileage", systemImage: "chevron.right") {
                    withAnimation(.snappy) {
                        state.browseTrendForward()
                    }
                }
                .labelStyle(.iconOnly)
                .disabled(!state.canBrowseNewerTrend)
            }

            HStack(alignment: .bottom, spacing: 16) {
                TrendAverageSummary(summary: state.trendSummary)

                Spacer(minLength: 8)

                TrendSelectedWeekSummary(
                    point: state.selectedTrendPoint,
                    comparison: state.selectedTrendComparison,
                    isCurrentWeek: state.isCurrentWeekSelectedInTrend
                )
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
            .chartYScale(domain: axisScale.lowerBound...axisScale.upperBound)
            .chartXAxis {
                AxisMarks(values: points.map(\.weekStart)) { value in
                    AxisValueLabel(
                        centered: false,
                        collisionResolution: .greedy(minimumSpacing: 0),
                        horizontalSpacing: 0
                    ) {
                        if let date = value.as(Date.self) {
                            Text(RunnerWeekAxisFormatter.string(for: date))
                                .font(.system(size: 7.5, weight: .medium))
                                .foregroundStyle(RunnerTheme.mutedText)
                                .fixedSize()
                        }
                    }
                    AxisTick().foregroundStyle(RunnerTheme.border)
                }
            }
            .chartYAxis {
                AxisMarks(
                    position: .leading,
                    values: .stride(by: axisScale.tickStride)
                ) { value in
                    AxisGridLine().foregroundStyle(RunnerTheme.border)
                    AxisValueLabel {
                        if let mileage = value.as(Double.self) {
                            Text(mileage, format: .number.precision(.fractionLength(0)))
                                .foregroundStyle(RunnerTheme.mutedText)
                        }
                    }
                }
            }
            .chartOverlay { proxy in
                GeometryReader { geometry in
                    if let plotFrame = proxy.plotFrame {
                        let frame = geometry[plotFrame]

                        if let selectedPoint = state.selectedTrendPoint,
                           points.contains(where: { $0.weekStart == selectedPoint.weekStart }),
                           let selectedX = proxy.position(forX: selectedPoint.weekStart),
                           let selectedY = proxy.position(forY: selectedPoint.actualMileage) {
                            ZStack {
                                Circle()
                                    .fill(RunnerTheme.accent.opacity(0.2))
                                    .frame(width: 24, height: 24)
                                Circle()
                                    .fill(Color.white.opacity(0.92))
                                    .frame(width: 16, height: 16)
                                Circle()
                                    .fill(Color(red: 0.52, green: 0.88, blue: 1.0))
                                    .frame(width: 12, height: 12)
                            }
                            .position(
                                x: frame.minX + selectedX,
                                y: frame.minY + selectedY
                            )
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                        }

                        ForEach(points) { point in
                            if let xPosition = proxy.position(forX: point.weekStart),
                               let yPosition = proxy.position(forY: point.actualMileage) {
                                Button {
                                    state.selectTrendPoint(point)
                                } label: {
                                    Circle()
                                        .fill(.clear)
                                        .contentShape(Circle())
                                        .frame(width: 44, height: 44)
                                }
                                .buttonStyle(.plain)
                                .position(
                                    x: frame.minX + xPosition,
                                    y: frame.minY + yPosition
                                )
                                .accessibilityLabel(
                                    "\(RunnerWeekRangeFormatter.string(for: point.weekStart)), \(point.actualMileage.formatted(.number.precision(.fractionLength(1)))) miles"
                                )
                                .accessibilityAddTraits(
                                    state.selectedTrendWeekStart == point.weekStart ? .isSelected : []
                                )
                            }
                        }
                    }
                }
            }
            .frame(height: 190)
            .accessibilityLabel("Actual weekly mileage trend")
            .simultaneousGesture(
                DragGesture(minimumDistance: 24)
                    .onEnded { value in
                        guard abs(value.translation.width) > abs(value.translation.height),
                              abs(value.translation.width) >= 44
                        else {
                            return
                        }

                        withAnimation(.snappy) {
                            if value.translation.width > 0 {
                                state.browseTrendBackward()
                            } else {
                                state.browseTrendForward()
                            }
                        }
                    }
            )
        }
        .runnerCard()
    }
}

private struct TrendSelectedWeekSummary: View {
    let point: MileageTrendPoint?
    let comparison: MileageComparison?
    let isCurrentWeek: Bool

    var body: some View {
        VStack(alignment: .trailing, spacing: 3) {
            if let point {
                Text(
                    isCurrentWeek
                        ? "This week"
                        : RunnerWeekRangeFormatter.string(for: point.weekStart)
                )
                .font(.caption2.weight(.semibold))
                .foregroundStyle(RunnerTheme.mutedText)

                HStack(spacing: 7) {
                    Text("\(point.actualMileage.formatted(.number.precision(.fractionLength(1)))) MI")
                        .font(.title3.bold())
                        .foregroundStyle(RunnerTheme.accent)
                        .monospacedDigit()

                    if let comparison {
                        TrendComparisonView(comparison: comparison)
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct TrendAverageSummary: View {
    let summary: MileageTrendSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("12-wk avg")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(RunnerTheme.mutedText)

            HStack(spacing: 7) {
                Text("\(summary.currentAverage.formatted(.number.precision(.fractionLength(1)))) mi")
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                TrendComparisonView(comparison: summary.averageComparison)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct TrendComparisonView: View {
    let comparison: MileageComparison

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(color)
            .monospacedDigit()
            .lineLimit(1)
    }

    private var text: String {
        if let percentage = comparison.percentageChange {
            switch comparison.direction {
            case .increase:
                return "▲ \(abs(percentage).formatted(.number.precision(.fractionLength(1))))%"
            case .decrease:
                return "▼ \(abs(percentage).formatted(.number.precision(.fractionLength(1))))%"
            case .unchanged:
                return "— 0.0%"
            }
        }

        guard comparison.absoluteChange != 0 else { return "No change" }
        return "+\(comparison.absoluteChange.formatted(.number.precision(.fractionLength(1)))) mi"
    }

    private var color: Color {
        comparison.direction == .increase && comparison.previous > 0
            ? RunnerTheme.accent
            : RunnerTheme.mutedText
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
                HStack(spacing: 5) {
                    Image(systemName: "clock")
                        .foregroundStyle(RunnerTheme.mutedText)
                    Text(startTime.formatted(.dateTime.hour().minute()))
                        .foregroundStyle(Color.white.opacity(0.92))
                }
                .font(.caption)
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
        VStack(alignment: .leading, spacing: 14) {
            Text("Weekly totals")
                .font(.subheadline.weight(.semibold))

            HStack(spacing: 8) {
                WeeklyTotalMetric(
                    value: "\(summary.actualMileage.formatted(.number.precision(.fractionLength(1)))) mi",
                    label: "Mileage",
                    isAccented: true
                )
                WeeklyTotalMetric(
                    value: WorkoutDuration.format(summary.totalDurationSeconds),
                    label: "Time"
                )
                WeeklyTotalMetric(
                    value: summary.workoutCount.formatted(),
                    label: "Workouts"
                )
            }
        }
        .runnerCard()
    }
}

private struct WeeklyTotalMetric: View {
    let value: String
    let label: String
    var isAccented = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.headline)
                .foregroundStyle(isAccented ? RunnerTheme.accent : .white)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(RunnerTheme.mutedText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
    @State private var durationMinutes: String
    @State private var durationSeconds: String
    @State private var startTime: Date
    @State private var includesStartTime: Bool
    @FocusState private var focusedField: Field?

    private enum Field {
        case title
        case distance
        case durationMinutes
        case durationSeconds
    }

    init(context: WorkoutEditorContext, save: @escaping (WorkoutInput) -> Void) {
        self.context = context
        self.save = save
        let workout = context.workout
        let duration = WorkoutDuration.components(from: workout?.durationSeconds)
        _title = State(initialValue: workout?.title ?? "")
        _distance = State(
            initialValue: workout?.distanceMiles.map {
                $0.formatted(.number.precision(.fractionLength(0...2)))
            } ?? ""
        )
        _durationMinutes = State(
            initialValue: workout?.durationSeconds == nil ? "" : String(duration.minutes)
        )
        _durationSeconds = State(
            initialValue: workout?.durationSeconds == nil ? "" : String(format: "%02d", duration.seconds)
        )
        _startTime = State(
            initialValue: WorkoutEditorDefaults.startTime(
                for: workout,
                workoutDate: context.date
            )
        )
        _includesStartTime = State(initialValue: workout == nil || workout?.startTime != nil)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Workout") {
                    LabeledContent("Date") {
                        Text(context.date, format: .dateTime.weekday(.abbreviated).month().day())
                    }
                    TextField("Workout title", text: $title)
                        .textInputAutocapitalization(.sentences)
                        .focused($focusedField, equals: .title)
                        .submitLabel(.next)
                        .onSubmit { focusedField = .distance }
                }

                Section("Actual execution") {
                    LabeledContent("Distance") {
                        HStack(spacing: 6) {
                            TextField("0.0", text: $distance)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .focused($focusedField, equals: .distance)
                                .frame(minWidth: 64)
                            Text("mi")
                                .foregroundStyle(RunnerTheme.mutedText)
                        }
                    }

                    LabeledContent("Duration") {
                        HStack(spacing: 6) {
                            TextField("0", text: $durationMinutes)
                                .keyboardType(.numberPad)
                                .multilineTextAlignment(.trailing)
                                .focused($focusedField, equals: .durationMinutes)
                                .frame(width: 48)
                            Text("min")
                                .foregroundStyle(RunnerTheme.mutedText)
                            TextField("00", text: $durationSeconds)
                                .keyboardType(.numberPad)
                                .multilineTextAlignment(.trailing)
                                .focused($focusedField, equals: .durationSeconds)
                                .frame(width: 42)
                            Text("sec")
                                .foregroundStyle(RunnerTheme.mutedText)
                        }
                    }

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
                        .disabled(!isFormValid)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { focusedField = nil }
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationDetents([.medium, .large])
    }

    private var derivedPace: String {
        guard let parsedDistance = WorkoutDistance.parse(distance),
              let parsedDuration
        else {
            return "—"
        }
        let pace = Int((Double(parsedDuration) / parsedDistance).rounded())
        return String(format: "%d:%02d /mi", pace / 60, pace % 60)
    }

    private var parsedDuration: Int? {
        WorkoutDuration.parse(minutes: durationMinutes, seconds: durationSeconds)
    }

    private var isFormValid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && WorkoutDistance.isValid(distance)
            && WorkoutDuration.fieldsAreValid(
                minutes: durationMinutes,
                seconds: durationSeconds
            )
    }

    private func saveWorkout() {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isFormValid else { return }

        save(
            WorkoutInput(
                date: context.date,
                title: trimmedTitle,
                distanceMiles: WorkoutDistance.parse(distance),
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
