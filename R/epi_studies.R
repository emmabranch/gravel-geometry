# epi_studies.R
# The analyses behind the "Geometry epidemiology" page. Reads the derived
# geometry and writes small result files that the page draws.
#
#   Study 1  Agreement: published versus recalculated values (Bland-Altman)
#   Study 2  Growth charts: reference centiles of stack for reach
#   Study 4  Marketing versus data: geometry clusters against category labels
#
# (Study 3, on smaller riders, runs live on the page because it uses the rider
# model in js/rider.js.)
#
# Run from the project folder:  source("R/epi_studies.R")
# Needs: readr, dplyr, here, quantreg  (install.packages("quantreg") if needed)

suppressPackageStartupMessages({
  library(readr)
  library(dplyr)
  library(quantreg)
})

geo <- read_csv(here::here("data", "gravel_geometry_derived.csv"), show_col_types = FALSE)
default <- filter(geo, is_default_config)
rad <- function(d) d * pi / 180

# ---------------------------------------------------------------------------
# Study 1: Bland-Altman agreement
# Each chart contains numbers that can be recalculated from the others. Treat
# the published value and the recalculated value as two measurements of the
# same thing, and ask how well they agree.
# ---------------------------------------------------------------------------
agree_long <- bind_rows(
  # Trail: published against recalculated with a 700 x 45 mm tyre
  default |> filter(!is.na(trail_published)) |>
    transmute(measure = "Trail", bike_id, brand, model, size_label,
              published = trail_published, calculated = trail_calc),
  # Wheelbase: published against rebuilt from stack, reach, angles, offset, chainstay
  default |> filter(fork_offset_source == "published") |>
    transmute(measure = "Wheelbase", bike_id, brand, model, size_label,
              published = wheelbase, calculated = wheelbase_calc),
  # Top tube: published against reach + stack / tan(seat angle)
  default |> filter(!is.na(top_tube_effective)) |>
    transmute(measure = "Top tube", bike_id, brand, model, size_label,
              published = top_tube_effective,
              calculated = reach + stack / tan(rad(seat_tube_angle))),
  # Fork offset: published against worked back from the wheelbase
  default |> filter(fork_offset_source == "published") |>
    transmute(measure = "Fork offset", bike_id, brand, model, size_label,
              published = fork_offset, calculated = offset_from_wheelbase)
) |>
  mutate(mean = (published + calculated) / 2, diff = calculated - published,
         across(c(calculated, mean, diff), \(x) round(x, 2)))

agree_summary <- agree_long |>
  group_by(measure) |>
  summarise(n_sizes = n(), n_bikes = n_distinct(bike_id),
            bias = mean(diff), sd = sd(diff),
            loa_low = bias - 1.96 * sd, loa_high = bias + 1.96 * sd,
            .groups = "drop") |>
  mutate(across(bias:loa_high, \(x) round(x, 2)))

# Brand-level bias for trail: does one manufacturer's chart sit apart?
trail_by_brand <- agree_long |>
  filter(measure == "Trail") |>
  group_by(brand, model) |>
  summarise(n = n(), bias = round(mean(diff), 1), .groups = "drop") |>
  arrange(desc(abs(bias)))

write_csv(agree_long, here::here("data", "epi_agreement.csv"))
write_csv(agree_summary, here::here("data", "epi_agreement_summary.csv"))

# ---------------------------------------------------------------------------
# Study 2: growth charts
# Paediatric growth charts give the centiles of height for age. Here: the
# centiles of stack for a given reach, across every production size, fitted by
# linear quantile regression. Each size then gets a "z-score": how far its
# stack sits from the median line, in robust standard deviations (the
# interquartile range divided by 1.349).
# ---------------------------------------------------------------------------
taus <- c(0.05, 0.25, 0.50, 0.75, 0.95)
fits <- lapply(taus, \(t) rq(stack ~ reach, tau = t, data = default))
names(fits) <- paste0("p", taus * 100)

reach_grid <- tibble(reach = seq(340, 460, by = 2))
centiles <- reach_grid
for (nm in names(fits)) centiles[[nm]] <- round(predict(fits[[nm]], newdata = reach_grid), 1)

pred <- function(nm) as.numeric(predict(fits[[nm]], newdata = default))
robust_sd <- (pred("p75") - pred("p25")) / 1.349
zscores <- default |>
  transmute(bike_id, brand, model, category, size_label, size_order, stack, reach,
            median_stack = round(pred("p50"), 1),
            z = round((stack - pred("p50")) / robust_sd, 2)) |>
  mutate(band = case_when(z <= -1.645 ~ "below 5th centile",
                          z >= 1.645 ~ "above 95th centile",
                          TRUE ~ "within 5th to 95th"))

write_csv(centiles, here::here("data", "epi_centiles.csv"))
write_csv(zscores, here::here("data", "epi_zscores.csv"))

# ---------------------------------------------------------------------------
# Study 4: does the marketing match the data?
# Describe each bike by size-independent features of its middle size, cluster
# the 24 bikes into three groups from geometry alone (Ward's method on
# standardised features), and measure agreement with the race / all-round /
# adventure labels with Cohen's kappa. Clusters have no names, so each cluster
# is given the label that maximises agreement (best of the 6 possible matchings).
# ---------------------------------------------------------------------------
mid <- default |>
  group_by(bike_id) |>
  arrange(size_order, .by_group = TRUE) |>
  slice(ceiling(n() / 2)) |>
  ungroup()

features <- c("stack_reach_ratio", "head_tube_angle", "trail_calc", "chainstay", "bb_drop", "tyre_clearance_mm")
X <- scale(as.matrix(mid[, features]))
hc <- hclust(dist(X), method = "ward.D2")
cluster <- cutree(hc, k = 3)

labels <- c("race", "all-round", "adventure")
perms <- list(c(1, 2, 3), c(1, 3, 2), c(2, 1, 3), c(2, 3, 1), c(3, 1, 2), c(3, 2, 1))
agreement_for <- function(p) mean(labels[p][cluster] == mid$category)
best <- perms[[which.max(vapply(perms, agreement_for, numeric(1)))]]
data_label <- labels[best][cluster]

cohen_kappa <- function(a, b) {
  lev <- union(a, b)
  tab <- table(factor(a, lev), factor(b, lev))
  po <- sum(diag(tab)) / sum(tab)
  pe <- sum(rowSums(tab) * colSums(tab)) / sum(tab)^2
  (po - pe) / (1 - pe)
}
kappa <- cohen_kappa(mid$category, data_label)

pcs <- prcomp(X)
var_explained <- round(100 * pcs$sdev^2 / sum(pcs$sdev^2), 1)
clusters_out <- mid |>
  transmute(bike_id, brand, model, size_label, category,
            stack_reach_ratio = round(stack_reach_ratio, 3), head_tube_angle,
            trail_calc, chainstay, bb_drop, tyre_clearance_mm) |>
  mutate(cluster = cluster, data_label = data_label,
         agrees = category == data_label,
         pc1 = round(pcs$x[, 1], 3), pc2 = round(pcs$x[, 2], 3))

# What each principal component means: the features that load on it most
loadings <- as_tibble(round(pcs$rotation[, 1:2], 3), rownames = "feature")

write_csv(clusters_out, here::here("data", "epi_clusters.csv"))
write_csv(loadings, here::here("data", "epi_pca_loadings.csv"))

summary_out <- tibble(
  item = c("kappa", "percent_agree", "pc1_var", "pc2_var", "n_bikes"),
  value = c(round(kappa, 2), round(100 * mean(clusters_out$agrees)), var_explained[1], var_explained[2], nrow(mid))
)
write_csv(summary_out, here::here("data", "epi_clusters_summary.csv"))

# ---------------------------------------------------------------------------
cat("\nStudy 1: agreement (calculated minus published)\n"); print(agree_summary)
cat("\nTrail bias by bike (mm):\n"); print(trail_by_brand, n = Inf)
cat("\nStudy 2: sizes outside the 5th to 95th centile of stack for reach:\n")
print(count(zscores, band))
print(filter(zscores, band != "within 5th to 95th") |> select(brand, model, size_label, stack, reach, z), n = Inf)
cat(sprintf("\nStudy 4: Cohen's kappa = %.2f; %d of %d bikes agree with their label\n",
            kappa, sum(clusters_out$agrees), nrow(clusters_out)))
print(table(label = mid$category, data = data_label))
print(filter(clusters_out, !agrees) |> select(brand, model, category, data_label), n = Inf)
