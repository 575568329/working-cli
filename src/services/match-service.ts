import type { Job, MatchResult, UserProfile } from "../client/types.js";

/**
 * 单词边界匹配检查 — 避免子串误匹配（如 "Java" 匹配到 "JavaScript"）
 * 先尝试精确匹配，再尝试分词边界匹配
 */
function isSkillMatch(jobSkill: string, userSkill: string): boolean {
  // 精确匹配
  if (jobSkill === userSkill) return true;
  // 单词边界匹配: userSkill 应作为完整单词出现在 jobSkill 中
  const escaped = userSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|[-\\s/+|.,])${escaped}(?:$|[-\\s/+|.,])`);
  return regex.test(jobSkill);
}

export class MatchService {
  matchBySkills(userSkills: string[], jobs: Job[]): MatchResult[] {
    const normalizedUserSkills = userSkills.map(s => s.toLowerCase().trim());

    return jobs.map(job => {
      const jobSkills = job.skills.map(s => s.toLowerCase().trim());
      const matched = jobSkills.filter(js =>
        normalizedUserSkills.some(us => isSkillMatch(js, us))
      );
      const missing = job.skills.filter(js =>
        !normalizedUserSkills.some(us => isSkillMatch(js.toLowerCase(), us))
      );

      const score = jobSkills.length > 0
        ? Math.round((matched.length / jobSkills.length) * 100)
        : 0;

      return {
        job,
        score,
        matchedSkills: matched.map(s => {
          const original = job.skills.find(js => js.toLowerCase() === s);
          return original ?? s;
        }),
        missingSkills: missing,
        reason: score >= 80
          ? "技能高度匹配"
          : score >= 50
            ? "部分技能匹配"
            : "技能差距较大",
      };
    }).sort((a, b) => b.score - a.score);
  }

  matchByProfile(profile: UserProfile, jobs: Job[]): MatchResult[] {
    return this.matchBySkills(profile.skills, jobs);
  }
}
