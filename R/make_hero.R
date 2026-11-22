# make_hero.R
# Draws the home page background: every bike in the dataset (middle size,
# default setting) to scale, lined up at the bottom bracket, as faint lines.
# One bike at a time lights up and its name fades in, in a slow loop.
#
# Writes figures/hero-bikes.svg. Run from the project folder:
#   source("R/make_hero.R")
#
# The frame points use the same construction as js/geometry.js.

suppressPackageStartupMessages({
  library(readr)
  library(dplyr)
})

geo <- read_csv(here::here("data", "gravel_geometry_derived.csv"), show_col_types = FALSE)

# One row per bike: the middle size of the default setting
mid <- geo |>
  filter(is_default_config) |>
  group_by(bike_id) |>
  arrange(size_order, .by_group = TRUE) |>
  slice(ceiling(n() / 2)) |>
  ungroup() |>
  arrange(brand, model)

rad <- function(d) d * pi / 180

# Write any non-ASCII letter (é, ², and so on) as an XML character code, so the
# SVG is valid whatever the computer's text encoding is
xml_text <- function(x) {
  x <- gsub("&", "&amp;", x, fixed = TRUE)
  x <- gsub("<", "&lt;", x, fixed = TRUE)
  vapply(x, function(s) {
    cp <- utf8ToInt(enc2utf8(s))
    paste(ifelse(cp > 127, sprintf("&#%d;", cp), intToUtf8(cp, multiple = TRUE)), collapse = "")
  }, character(1), USE.NAMES = FALSE)
}
f1 <- function(x) sprintf("%.1f", x)

bike_svg <- function(g) {
  d <- g$bb_drop
  ha <- rad(g$head_tube_angle); sa <- rad(g$seat_tube_angle)
  R <- 311 + ifelse(g$wheel_size == "29er", 57, 45)
  ht <- ifelse(is.na(g$head_tube_length), max(80, g$stack - 434), g$head_tube_length)
  st <- ifelse(is.na(g$seat_tube_length), 0.86 * g$stack, g$seat_tube_length)
  off <- g$fork_offset_used

  down <- c(cos(ha), -sin(ha))
  rear <- c(-sqrt(g$chainstay^2 - d^2), d)
  htt  <- c(g$reach, g$stack)
  htb  <- htt + ht * down
  front <- c(g$reach + (g$stack - d) / tan(ha) + off / sin(ha), d)
  stdir <- c(-cos(sa), sin(sa))
  stt  <- st * stdir
  ttf  <- htt + 15 * down
  ttr  <- stt - 20 * stdir
  sst  <- stt - 55 * stdir
  bb   <- c(0, 0)

  # SVG y runs down, so flip y
  seg <- function(a, b) sprintf('<line x1="%s" y1="%s" x2="%s" y2="%s"/>', f1(a[1]), f1(-a[2]), f1(b[1]), f1(-b[2]))
  circ <- function(c, r) sprintf('<circle cx="%s" cy="%s" r="%s"/>', f1(c[1]), f1(-c[2]), f1(r))

  paste0(
    seg(htt, htb), seg(ttf, ttr), seg(htb, bb), seg(bb, stt),
    seg(bb, rear), seg(rear, sst), seg(htb, front),
    circ(rear, R), circ(front, R)
  )
}

n <- nrow(mid)
step <- 1.6                 # seconds each bike is lit
cycle <- n * step           # one full loop through every bike

groups <- vapply(seq_len(n), function(i) {
  g <- mid[i, ]
  sprintf('<g class="bike" style="animation-delay:%ss">%s</g>', f1((i - 1) * step), bike_svg(g))
}, character(1))

labels <- vapply(seq_len(n), function(i) {
  g <- mid[i, ]
  sprintf('<text class="name" x="1240" y="-1080" style="animation-delay:%ss">%s %s, size %s</text>',
          f1((i - 1) * step), xml_text(g$brand), xml_text(g$model), xml_text(g$size_label))
}, character(1))

# How much of the loop each bike spends lit (as a share of the cycle)
on_start <- 100 * 0.15 / cycle
on_peak  <- 100 * 0.35 / cycle
on_end   <- 100 * (step - 0.1) / cycle
off_end  <- 100 * (step + 0.4) / cycle
pct <- function(x) sprintf("%.2f%%", x)

css <- paste0(
  "<style>",
  ".bike{fill:none;stroke:#ffffff;stroke-opacity:0.10;stroke-width:3.6;stroke-linecap:round;",
  "animation:glow ", f1(cycle), "s linear infinite;}",
  ".bike circle{stroke-width:2.4;}",
  "@keyframes glow{0%{stroke:#ffffff;stroke-opacity:0.10;}",
  pct(on_start), "{stroke:#e2c9a6;stroke-opacity:0.10;}",
  pct(on_peak), "{stroke:#e2c9a6;stroke-opacity:1;stroke-width:5;}",
  pct(on_end), "{stroke:#e2c9a6;stroke-opacity:1;stroke-width:5;}",
  pct(off_end), "{stroke:#ffffff;stroke-opacity:0.10;}",
  "100%{stroke:#ffffff;stroke-opacity:0.10;}}",
  ".name{fill:#e2c9a6;fill-opacity:0;font:600 54px Inter,Helvetica,Arial,sans-serif;text-anchor:end;",
  "animation:label ", f1(cycle), "s linear infinite;}",
  "@keyframes label{0%{fill-opacity:0;}", pct(on_peak), "{fill-opacity:1;}",
  pct(on_end), "{fill-opacity:1;}", pct(off_end), "{fill-opacity:0;}100%{fill-opacity:0;}}",
  "@media (prefers-reduced-motion: reduce){.bike,.name{animation:none;}}",
  "</style>"
)

# Bottom bracket at (0, 0); the view is anchored to the right so the bikes sit
# behind the right-hand side of the hero and the headline stays clear.
svg <- paste0(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3700 -1250 5000 2250" ',
  'preserveAspectRatio="xMaxYMid slice" role="img" ',
  'aria-label="All ', n, ' bikes drawn to scale over each other, lit up one at a time">',
  css, paste(groups, collapse = ""), paste(labels, collapse = ""), "</svg>"
)

dir.create(here::here("figures"), showWarnings = FALSE)
writeLines(svg, here::here("figures", "hero-bikes.svg"))
cat("Wrote figures/hero-bikes.svg:", n, "bikes, one loop every", cycle, "seconds\n")
