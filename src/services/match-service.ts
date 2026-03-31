import type { Job, MatchResult, UserProfile } from "../client/types.js";

export class MatchService {
  matchBySkills(userSkills: string[], jobs: Job[]): MatchResult[] {
    const normalizedUserSkills = userSkills.map(s => s.toLowerCase().trim());

    return jobs.map(job => {
      const jobSkills = job.skills.map(s => s.toLowerCase().trim());
      const matched = jobSkills.filter(js =>
        normalizedUserSkills.some(us => js.includes(us) || us.includes(js))
      );
      const missing = job.skills.filter(js =>
        !normalizedUserSkills.some(us => js.toLowerCase().includes(us) || us.toLowerCase().includes(js))
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
