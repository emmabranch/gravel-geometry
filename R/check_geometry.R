# check_geometry.R
# Sanity checks on the hand-typed gravel geometry dataset.
# Nothing here changes the data. It prints a short report of anything that
# does not add up, so typing slips (or odd manufacturer charts) stand out.
#
# Run from the project folder:  source("R/check_geometry.R")

suppressPackageStartupMessages({
  library(readr)
  library(dplyr)
})

geo <- read_csv(here::here("data", "gravel_geometry.csv"), show_col_types = FALSE)

# Reference wheel radius for recalculating trail: 700c rim (622 mm bead seat)
# plus a 45 mm tyre, assuming tyre height is about the same as its width.
# The Cutthroat runs 29 x 2.25" (about 57 mm).
wheel_radius <- function(wheel_size) ifelse(wheel_size == "29er", 311 + 57, 311 + 45)
rad <- function(deg) deg * pi / 180

checks <- geo |>
  mutate(
    r = wheel_radius(wheel_size),
    hta = rad(head_tube_angle),
    sta = rad(seat_tube_angle),

    # 1. Trail from head angle, offset, and wheel radius
    trail_calc = (r * cos(hta) - fork_offset) / sin(hta),
    trail_gap  = trail_calc - trail_published,

    # 2. Effective top tube should equal reach plus the seat tube's lean at stack height
    ett_calc = reach + stack / tan(sta),
    ett_gap  = ett_calc - top_tube_effective,

    # 3. Wheelbase rebuilt from stack, reach, head angle, offset, BB drop, and chainstay
    fc_horizontal = reach + (stack - bb_drop) / tan(hta) + fork_offset / sin(hta),
    cs_horizontal = sqrt(chainstay^2 - bb_drop^2),
    wb_calc = fc_horizontal + cs_horizontal,
    wb_gap  = wb_calc - wheelbase,

    # 4. Published front centre plus chainstay should also give the wheelbase
    wb_from_fc = sqrt(front_centre^2 - bb_drop^2) + cs_horizontal,
    fc_gap = wb_from_fc - wheelbase
  )

flag <- function(df, gap, tol, label) {
  df |>
    filter(!is.na({{ gap }}), abs({{ gap }}) > tol) |>
    transmute(bike_id, config, size_label, check = label, gap_mm = round({{ gap }}, 1))
}

report <- bind_rows(
  flag(checks, trail_gap, 6,  "trail recalculated vs published (> 6 mm)"),
  flag(checks, ett_gap,  12, "top tube recalculated vs published (> 12 mm)"),
  flag(checks, wb_gap,   10, "wheelbase rebuilt from frame vs published (> 10 mm)"),
  flag(checks, fc_gap,    6, "front centre + chainstay vs wheelbase (> 6 mm)")
)

# 5. Stack and reach should not shrink as sizes get bigger
shrinking <- geo |>
  group_by(bike_id, config) |>
  arrange(size_order, .by_group = TRUE) |>
  summarise(
    stack_ok = all(diff(stack) >= 0, na.rm = TRUE),
    reach_ok = all(diff(reach) >= 0, na.rm = TRUE),
    .groups = "drop"
  ) |>
  filter(!stack_ok | !reach_ok)

# Summary ---------------------------------------------------------------
cat("\nGravel geometry checks\n")
cat("  Bikes:", n_distinct(geo$bike_id), "\n")
cat("  Rows (bike x setting x size):", nrow(geo), "\n")
cat("  Rows checkable for each test:\n")
cat("    trail:", sum(!is.na(checks$trail_gap)),
    "  top tube:", sum(!is.na(checks$ett_gap)),
    "  wheelbase:", sum(!is.na(checks$wb_gap)),
    "  front centre:", sum(!is.na(checks$fc_gap)), "\n\n")

if (nrow(report) == 0) {
  cat("No measurement flags.\n")
} else {
  cat("Measurement flags (", nrow(report), "):\n", sep = "")
  print(report, n = Inf)
}

if (nrow(shrinking) == 0) {
  cat("\nStack and reach grow (or stay level) with size for every bike.\n")
} else {
  cat("\nStack or reach shrinks between sizes:\n")
  print(shrinking)
}
