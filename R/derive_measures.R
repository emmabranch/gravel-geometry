# derive_measures.R
# Adds calculated measures to the hand-typed geometry and writes
#   data/gravel_geometry_derived.csv
# which is the file the website reads. The typed-in file is never changed.
#
# Run from the project folder:  source("R/derive_measures.R")

suppressPackageStartupMessages({
  library(readr)
  library(dplyr)
})

geo <- read_csv(here::here("data", "gravel_geometry.csv"), show_col_types = FALSE)

# ---- Assumptions (documented on the site's Methods page) -------------------
# Reference tyre for trail and toe clearance: 700 x 45 mm, tyre height taken as
# equal to width. The Salsa Cutthroat uses its stock 29 x 2.25" (57 mm) tyre.
ref_tyre_mm   <- 45
cutthroat_mm  <- 57
ref_crank_mm  <- 172.5   # crank length for the toe clearance figure
rad <- function(deg) deg * pi / 180

derived <- geo |>
  mutate(
    hta = rad(head_tube_angle),
    wheel_radius = 311 + if_else(wheel_size == "29er", cutthroat_mm, ref_tyre_mm),
    cs_horizontal = sqrt(chainstay^2 - bb_drop^2),

    # Fork offset worked back from the wheelbase. Where a manufacturer publishes
    # offset this lands within 2 mm of it for 115 of 118 sizes, so it is a fair
    # estimate where offset is missing.
    offset_from_wheelbase = (wheelbase - cs_horizontal - reach - (stack - bb_drop) / tan(hta)) * sin(hta),

    fork_offset_source = case_when(
      bike_id == "santacruz_stigmata" ~ "estimated (FAQ value of 45 mm does not fit the chart)",
      !is.na(fork_offset)             ~ "published",
      !is.na(offset_from_wheelbase)   ~ "estimated from wheelbase",
      TRUE                            ~ "unknown"
    ),
    fork_offset_used = case_when(
      fork_offset_source == "published" ~ fork_offset,
      TRUE ~ round(offset_from_wheelbase)
    ),

    # Trail: how far the tyre's contact patch trails behind where the steering
    # axis meets the ground. Mechanical trail is the same gap measured at right
    # angles to the steering axis, which is what the rider actually feels.
    trail_calc = (wheel_radius * cos(hta) - fork_offset_used) / sin(hta),
    mechanical_trail = trail_calc * sin(hta),

    # Wheel flop: how far the front of the bike drops as the bars turn.
    # Higher means the steering wants to fall into turns at low speed.
    wheel_flop = trail_calc * sin(hta) * cos(hta),

    stack_reach_ratio = stack / reach,

    # Front centre rebuilt from the frame: horizontal BB-to-front-axle distance
    front_centre_calc = reach + (stack - bb_drop) / tan(hta) + fork_offset_used / sin(hta),
    wheelbase_calc = front_centre_calc + cs_horizontal,
    wheelbase_gap = wheelbase_calc - wheelbase,

    # Toe clearance: gap between the pedal axle (crank pointing forward) and the
    # front tyre. A typical shoe reaches 90 to 110 mm ahead of the pedal axle, so
    # small numbers here suggest toe overlap in tight, slow turns.
    front_centre_direct = sqrt(front_centre_calc^2 + bb_drop^2),
    toe_clearance = front_centre_direct - wheel_radius - ref_crank_mm,

    # Flags for the site
    offset_estimated = fork_offset_source != "published",
    flag_note = case_when(
      bike_id == "3t_racemax2" & size_label == "S" ~ "Estimated offset for size S (68 mm) is unusually large; treat its trail with caution.",
      bike_id == "canyon_grizl_cf" & size_label == "2XS" ~ "2XS appears to use a smaller wheel; 700c reference values may not apply.",
      TRUE ~ NA_character_
    )
  ) |>
  mutate(across(c(offset_from_wheelbase, trail_calc, mechanical_trail, wheel_flop,
                  front_centre_calc, wheelbase_calc, wheelbase_gap,
                  front_centre_direct, toe_clearance), \(x) round(x, 1)),
         stack_reach_ratio = round(stack_reach_ratio, 3)) |>
  select(-hta, -cs_horizontal)

write_csv(derived, here::here("data", "gravel_geometry_derived.csv"), na = "")

cat("Wrote data/gravel_geometry_derived.csv:", nrow(derived), "rows,",
    n_distinct(derived$bike_id), "bikes\n")
cat("Fork offset sources:\n")
print(count(distinct(derived, bike_id, fork_offset_source), fork_offset_source))
cat("\nTrail (reference 700 x 45 tyre), default settings only:\n")
derived |>
  filter(is_default_config) |>
  group_by(category) |>
  summarise(bikes = n_distinct(bike_id),
            trail_min = min(trail_calc, na.rm = TRUE),
            trail_max = max(trail_calc, na.rm = TRUE),
            stack_reach_median = round(median(stack_reach_ratio), 2)) |>
  print()
