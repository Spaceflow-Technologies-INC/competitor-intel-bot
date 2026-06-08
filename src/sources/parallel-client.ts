export type WebSearchResult = {
  url: string;
  title: string;
  publishDate?: string;
  excerpts: string[];
};

export type ExtractedPage = {
  url: string;
  title: string;
  publishDate?: string;
  excerpts: string[];
  fullContent?: string;
};

export type WebIntelClient = {
  search(input: { objective: string; searchQueries: string[]; maxResults?: number }): Promise<WebSearchResult[]>;
  extract(input: { urls: string[]; objective: string; searchQueries?: string[] }): Promise<ExtractedPage[]>;
};

export class ParallelClient implements WebIntelClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.parallel.ai";
  }

  async search(input: { objective: string; searchQueries: string[]; maxResults?: number }): Promise<WebSearchResult[]> {
    const json = await this.post<ParallelSearchResponse>("/v1/search", {
      objective: input.objective,
      search_queries: input.searchQueries,
      max_results: input.maxResults ?? 5,
      max_chars_per_result: 1200
    });
    return json.results.map((result) => {
      const item: WebSearchResult = {
        url: result.url,
        title: result.title ?? result.url,
        excerpts: result.excerpts ?? []
      };
      return result.publish_date ? { ...item, publishDate: result.publish_date } : item;
    });
  }

  async extract(input: { urls: string[]; objective: string; searchQueries?: string[] }): Promise<ExtractedPage[]> {
    if (input.urls.length === 0) {
      return [];
    }
    const json = await this.post<ParallelExtractResponse>("/v1/extract", {
      urls: input.urls.slice(0, 20),
      objective: input.objective,
      search_queries: input.searchQueries,
      max_chars_total: 12000
    });
    return json.results.map((result) => {
      const page: ExtractedPage = {
        url: result.url,
        title: result.title ?? result.url,
        excerpts: result.excerpts ?? []
      };
      const withPublishDate = result.publish_date ? { ...page, publishDate: result.publish_date } : page;
      return result.full_content ? { ...withPublishDate, fullContent: result.full_content } : withPublishDate;
    });
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey
      },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Parallel API ${path} failed: ${response.status} ${text.slice(0, 300)}`);
    }
    return JSON.parse(text) as T;
  }
}

type ParallelSearchResponse = {
  results: Array<{
    url: string;
    title?: string;
    publish_date?: string;
    excerpts?: string[];
  }>;
};

type ParallelExtractResponse = {
  results: Array<{
    url: string;
    title?: string;
    publish_date?: string;
    excerpts?: string[];
    full_content?: string;
  }>;
};
