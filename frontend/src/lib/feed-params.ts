import { FeedFilterValues } from "@/validations/feed";

/**
 * Short URL param keys to keep URLs concise.
 * q=query, src=sources, wm=workModes, exp=experience, jt=jobTypes,
 * sal=salaryMin, sp=salaryPeriod, dp=datePosted, sort=sortBy,
 * loc_t/loc_v/loc_vs=location
 */

export function paramsToFilters(
  params: URLSearchParams,
): Partial<FeedFilterValues> {
  const result: Partial<FeedFilterValues> = {};

  const q = params.get("q");
  if (q) result.query = q;

  const src = params.get("src");
  if (src) result.sources = src.split(",");

  const wm = params.get("wm");
  if (wm) result.workModes = wm.split(",");

  const exp = params.get("exp");
  if (exp) result.experience = exp.split(",");

  const jt = params.get("jt");
  if (jt) result.jobTypes = jt.split(",");

  const sal = params.get("sal");
  if (sal) result.salaryMin = sal;

  const sp = params.get("sp") as FeedFilterValues["salaryPeriod"];
  if (sp) result.salaryPeriod = sp;

  const dp = params.get("dp");
  if (dp) result.datePosted = dp;

  const sort = params.get("sort");
  if (sort) result.sortBy = sort;

  const locT = params.get("loc_t");
  if (locT) {
    result.location = {
      type: locT as "region" | "country" | "city",
      value: params.get("loc_v") ?? undefined,
      values: params.get("loc_vs")?.split(",") ?? undefined,
    };
  }

  return result;
}

export function filtersToParams(values: FeedFilterValues): URLSearchParams {
  const p = new URLSearchParams();

  if (values.query) p.set("q", values.query);
  if (values.sources?.length) p.set("src", values.sources.join(","));
  if (values.workModes?.length) p.set("wm", values.workModes.join(","));
  if (values.experience?.length) p.set("exp", values.experience.join(","));
  if (values.jobTypes?.length) p.set("jt", values.jobTypes.join(","));
  if (values.salaryMin) p.set("sal", values.salaryMin);
  if (values.salaryPeriod && values.salaryPeriod !== "annual")
    p.set("sp", values.salaryPeriod);
  if (values.datePosted) p.set("dp", values.datePosted);
  if (values.sortBy) p.set("sort", values.sortBy);

  if (values.location?.type) {
    p.set("loc_t", values.location.type);
    if (values.location.value) p.set("loc_v", values.location.value);
    if (values.location.values?.length)
      p.set("loc_vs", values.location.values.join(","));
  }

  return p;
}