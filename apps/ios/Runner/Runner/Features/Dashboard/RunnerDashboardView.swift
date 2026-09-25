import Charts
import SwiftUI

struct RunnerDashboardView: View {
    @State private var state = DashboardState.mock()
    @State private var showingAddWorkoutNotice = false

    var body: some View {
        ZStack {
            RunnerTheme.background
                .ignoresSafeArea()

            ScrollView {
                LazyVStack(spacing: 20) {
                    RunnerHeaderView()
                    MileageTrendView(points: state.trend)
                    WeekOverviewView(state: state)
                    SelectedDayView(
                        date: state.selectedDate,
                        workouts: state.selectedDayWorkouts,
                        addWorkout: { showingAddWorkoutNotice = true }
                    )
                    WeeklyMileageSummaryView(summary: state.week)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 36)
            }
            .scrollIndicators(.hidden)
        }
        .preferredColorScheme(.dark)
        .alert("Add workout", isPresented: $showingAddWorkoutNotice) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Workout creation will be connected in a later milestone.")
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

            VStack(alignment: .leading, spacing: 2) {
                Text("Runner")
                    .font(.title2.bold())
                Text("YOUR TRAINING, THIS WEEK")
                    .font(.caption2.weight(.semibold))
                    .tracking(1.2)
                    .foregroundStyle(RunnerTheme.mutedText)
            }

            Spacer()
        }
        .padding(.top, 12)
        .accessibilityElement(children: .combine)
    }
}

private struct MileageTrendView: View {
    let points: [MileageTrendPoint]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Weekly mileage")
                        .font(.headline)
                    Text("Actual miles only")
                        .font(.caption)
                        .foregroundStyle(RunnerTheme.mutedText)
                }

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
            .frame(height: 190)
            .accessibilityLabel("Actual weekly mileage trend")
        }
        .runnerCard()
    }
}

private struct WeekOverviewView: View {
    @Bindable var state: DashboardState

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(state.week.weekStart, format: .dateTime.month(.wide).day())
                    .font(.headline)
                Text("–")
                    .foregroundStyle(RunnerTheme.mutedText)
                if let weekEnd = state.weekDates.last {
                    Text(weekEnd, format: .dateTime.month(.abbreviated).day())
                        .font(.headline)
                }
                Spacer()
            }

            HStack(spacing: 6) {
                ForEach(state.weekDates, id: \.self) { date in
                    WeekdayButton(
                        date: date,
                        mileage: state.week.actualMileage(on: date),
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
                VStack(spacing: 10) {
                    ForEach(workouts) { workout in
                        WorkoutRow(workout: workout)
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

                if let startTime = workout.startTime {
                    Text(startTime, format: .dateTime.hour().minute())
                        .font(.caption)
                        .foregroundStyle(RunnerTheme.mutedText)
                }
            }

            HStack(spacing: 20) {
                WorkoutMetric(label: "DISTANCE", value: distanceText)
                WorkoutMetric(label: "DURATION", value: durationText)
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

    private var durationText: String {
        guard let duration = workout.durationSeconds else { return "—" }
        let hours = duration / 3_600
        let minutes = (duration % 3_600) / 60
        let seconds = duration % 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, seconds)
            : String(format: "%d:%02d", minutes, seconds)
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
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct WeeklyMileageSummaryView: View {
    let summary: WeekSummary

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Weekly actual")
                    .font(.subheadline.weight(.semibold))
                Text("Completed distance across all sessions")
                    .font(.caption)
                    .foregroundStyle(RunnerTheme.mutedText)
            }

            Spacer()

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

#Preview {
    RunnerDashboardView()
}
