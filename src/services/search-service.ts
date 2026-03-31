import { BossClient } from "../client/boss-client.js";
import type { Job, SearchResult, JobDetail } from "../client/types.js";
import type { Database } from "../store/db.js";

export class SearchService {
  private bossClient: BossClient;
  private db: Database | null;

  constructor(bossClient: BossClient, db?: Database) {
    this.bossClient = bossClient;
    this.db = db ?? null;
  }

  async search(params: {
    query: string;
    city?: string;
    page?: number;
    pageSize?: number;
    experience?: string;
    degree?: string;
    salary?: string;
    industry?: string;
    scale?: string;
    stage?: string;
    jobType?: string;
  }): Promise<SearchResult> {
    const data = await this.bossClient.searchJobs(params);

    const result: SearchResult = {
      jobList: data?.jobList ?? [],
      hasMore: data?.hasMore ?? false,
      totalCount: data?.totalCount ?? 0,
      page: params.page ?? 1,
    };

    // 保存搜索历史
    this.db?.saveSearchHistory({
      keyword: params.query,
      city: params.city,
      filters: JSON.stringify(params),
      resultCount: result.totalCount,
    });

    return result;
  }

  async detail(securityId: string, lid?: string): Promise<JobDetail> {
    const data = await this.bossClient.getJobDetail(securityId, lid);
    return data as JobDetail;
  }

  async recommend(page = 1): Promise<SearchResult> {
    const data = await this.bossClient.getRecommendJobs(page);
    return {
      jobList: data?.jobList ?? [],
      hasMore: data?.hasMore ?? false,
      totalCount: data?.totalCount ?? 0,
      page,
    };
  }
}
