/**
 * Skill normalisation + proficiency inference.
 * Kept out of the route handlers so the API and any future batch job agree.
 */

/** Canonical key for de-duplicating "PostGIS" / "postgis" / "Post GIS". */
export function skillKey(skill) {
  return String(skill)
    .toLowerCase()
    .replace(/[._/\-]+/g, " ")
    .replace(/[^a-z0-9+#\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Trim and collapse whitespace but keep the user-facing casing. */
export function cleanSkill(skill) {
  return String(skill).replace(/\s+/g, " ").trim();
}

/**
 * Infer proficiency from how often a skill appears and over how long a period.
 * Repetition alone is shallow; repetition sustained over months is depth.
 */
export function inferProficiency(occurrenceCount, firstSeen, lastSeen) {
  const count = occurrenceCount || 0;
  let months = 0;
  if (firstSeen && lastSeen) {
    months = Math.max(0, (new Date(lastSeen) - new Date(firstSeen)) / (1000 * 60 * 60 * 24 * 30.4));
  }

  if (count >= 25 && months >= 6) return "expert";
  if (count >= 10 && months >= 2) return "advanced";
  if (count >= 4) return "intermediate";
  return "beginner";
}

/** 1.0 = used today, decaying to 0 over ~180 days of silence. */
export function recencyScore(lastSeen) {
  if (!lastSeen) return 0;
  const days = Math.max(0, (Date.now() - new Date(lastSeen)) / (1000 * 60 * 60 * 24));
  return Math.round(Math.max(0, 1 - days / 180) * 100) / 100;
}

/** Collapse an AI skill list to unique, cleaned {skill, key} pairs. */
export function normaliseSkillList(rawSkills) {
  const seen = new Set();
  const out = [];
  for (const s of rawSkills || []) {
    const skill = cleanSkill(s);
    const key = skillKey(skill);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ skill, key });
  }
  return out;
}

/**
 * Fold a log entry's skills into the ledger: 1 read + 1 bulk upsert, not 2N round trips.
 * Shared by log creation and re-extraction so both age the ledger identically.
 */
export async function foldSkillsIntoLedger(supabase, userId, skills, domains, loggedDate) {
  if (!skills.length) return;

  const { data: existing } = await supabase
    .from("skill_ledger")
    .select("skill, skill_key, domain, domains, first_seen, last_seen, occurrence_count")
    .eq("user_id", userId)
    .in("skill_key", skills.map(s => s.key));

  const byKey = new Map((existing || []).map(r => [r.skill_key, r]));

  const rows = skills.map(({ skill, key }) => {
    const prev = byKey.get(key);
    // Backdated entries must be able to move first_seen earlier, never later.
    const firstSeen = prev?.first_seen && prev.first_seen < loggedDate ? prev.first_seen : loggedDate;
    const lastSeen = prev?.last_seen && prev.last_seen > loggedDate ? prev.last_seen : loggedDate;
    const count = (prev?.occurrence_count || 0) + 1;

    // Accumulate every domain a skill has been used in — never clobber the old one.
    const mergedDomains = Array.from(new Set([...(prev?.domains || []), ...domains]));

    // No `id`: the (user_id, skill_key) conflict target resolves the row, and omitting
    // columns from the payload leaves them (proficiency_override, created_at) untouched.
    return {
      user_id: userId,
      skill: prev?.skill || skill,
      skill_key: key,
      // Primary domain stays sticky once set; falls back to this entry's first domain.
      domain: prev?.domain || domains[0] || null,
      domains: mergedDomains,
      first_seen: firstSeen,
      last_seen: lastSeen,
      occurrence_count: count,
      recency_score: recencyScore(lastSeen),
      proficiency_estimate: inferProficiency(count, firstSeen, lastSeen),
    };
  });

  const { error } = await supabase
    .from("skill_ledger")
    .upsert(rows, { onConflict: "user_id,skill_key" });

  if (error) console.error("skill_ledger upsert failed:", error.message);
}

/** Lowercase + de-duplicate the domain labels the model returned. */
export function normaliseDomains(rawDomains) {
  return Array.from(
    new Set((rawDomains || []).map(d => String(d).toLowerCase().trim()).filter(Boolean))
  );
}
