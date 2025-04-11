import * as dotenv from 'dotenv';

dotenv.config();

interface PullRequest {
  created_at: string;
  merged_at: string | null;
  number: number;
  head: { repo: { name: string } | null };
}

interface Review {
  submitted_at: string;
}

async function getGitHubPrMetrics(
  owner: string,
  repo: string,
  token: string,
  startDate: Date,
  endDate: Date
): Promise<[number[], number[]]> {
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  let url: string | null = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&per_page=100`;
  const allPullRequests: PullRequest[] = [];

  while (url) {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const pullRequests = await response.json() as PullRequest[];
    allPullRequests.push(...pullRequests);

    const linkHeader = response.headers.get('Link');
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const nextUrlMatch = linkHeader.match(/<([^>]+)>; rel="next"/);
      url = nextUrlMatch ? nextUrlMatch[1] : null;
    } else {
      url = null;
    }
  }

  const reviewTimes: number[] = [];
  const mergeTimes: number[] = [];
  for (const pr of allPullRequests) {
    const createdAt = new Date(pr.created_at);
    const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;

    if (createdAt >= startDate && createdAt <= endDate) {
      if (mergedAt) {
        mergeTimes.push((mergedAt.getTime() - createdAt.getTime()) / 1000);
      }
      const repoName = pr.head?.repo?.name;
      if (!repoName) {
        console.log(`Warning: Repo name not found for PR #${pr.number}. Skipping reviews.`);
        continue;
      }
      const reviewUrl = `https://api.github.com/repos/${owner}/${repoName}/pulls/${pr.number}/reviews`;
      const reviewResponse = await fetch(reviewUrl, { headers });

      if (!reviewResponse.ok) {
        if (reviewResponse.status === 404) {
          console.log(`Review not found for PR #${pr.number} in ${repoName}`);
          continue;
        } else {
          throw new Error(`HTTP error! status: ${reviewResponse.status}`);
        }
      }

      const reviews = await reviewResponse.json() as Review[];

      if (reviews && reviews.length > 0) {
        const firstReviewTime = new Date(reviews[0].submitted_at);
        reviewTimes.push((firstReviewTime.getTime() - createdAt.getTime()) / 1000);
      }
    }
  }

  return [reviewTimes, mergeTimes];
}

function calculateAverageTime(timeList: number[]): number {
  if (timeList.length === 0) {
    return 0;
  }
  return timeList.reduce((acc, time) => acc + time, 0) / timeList.length;
}

async function main() {
  const owner: string = '';  // your own github username or organization name
  const repositories: string[] = [];  // list of repositories to analyze
  const token = process.env.GITHUB_TOKEN; // your github token from https://github.com/settings/tokens

  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable not set.');
    process.exit(1);
  }

  const startDate = new Date('2024-01-01T00:00:00Z');
  const endDate = new Date('2025-02-01T00:00:00Z');

  try {
    const headers = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    const allPullRequests: PullRequest[] = [];

    // Fetch all pull requests first
    for (const repo of repositories) {
      let url: string | null = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&per_page=100`;
      while (url) {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          if (response.status === 404) {
            console.log(`Repository not found: ${url}`);
            break;
          } else {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        }
        const pullRequests = await response.json() as PullRequest[];
        allPullRequests.push(...pullRequests);

        const linkHeader = response.headers.get('Link');
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const nextUrlMatch = linkHeader.match(/<([^>]+)>; rel="next"/);
          url = nextUrlMatch ? nextUrlMatch[1] : null;
        } else {
          url = null;
        }
      }
    }

    if (allPullRequests.length === 0) {
      console.log('No pull requests found. Exiting.');
      return;
    }

    const detailedMetrics: { prNumber: number; reviewTime: number | null; mergeTime: number | null; repo: string }[] = [];

    // Process each pull request to gather detailed metrics
    for (const pr of allPullRequests) {
      const createdAt = new Date(pr.created_at);
      const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;

      if (createdAt >= startDate && createdAt <= endDate) {
        let reviewTime: number | null = null;
        let mergeTime: number | null = null;

        if (mergedAt) {
          mergeTime = (mergedAt.getTime() - createdAt.getTime()) / 1000;
        }
        const repoName = pr.head?.repo?.name;
        if (!repoName) {
          console.log(`Warning: Repo name not found for PR #${pr.number}. Skipping detailed metrics.`);
          detailedMetrics.push({ prNumber: pr.number, reviewTime: null, mergeTime: mergeTime, repo: 'N/A' });
          continue;
        }
        const reviewUrl = `https://api.github.com/repos/${owner}/${repoName}/pulls/${pr.number}/reviews`;
        const reviewResponse = await fetch(reviewUrl, { headers });

        if (!reviewResponse.ok) {
          if (reviewResponse.status === 404) {
            console.log(`Review not found for PR #${pr.number} in ${repoName}`);
            continue;
          } else {
            throw new Error(`HTTP error! status: ${reviewResponse.status}`);
          }
        }

        const reviews = await reviewResponse.json() as Review[];

        if (reviews && reviews.length > 0) {
          const firstReviewTime = new Date(reviews[0].submitted_at);
          reviewTime = (firstReviewTime.getTime() - createdAt.getTime()) / 1000;
        }
        detailedMetrics.push({ prNumber: pr.number, reviewTime, mergeTime, repo: repoName });
      }
    }

    // Log individual PR metrics (if needed)
    // for (const metric of detailedMetrics) {
    //   console.log(`PR #${metric.prNumber}:`);
    //   console.log(` Repo: ${metric.repo}`);
    //   console.log(` Time to first review: ${metric.reviewTime ? (metric.reviewTime / 3600).toFixed(2) + ' hours' : 'N/A'}`);
    //   console.log(` Time to merge: ${metric.mergeTime ? (metric.mergeTime / 3600).toFixed(2) + ' hours' : 'N/A'}`);
    // }

    // Calculate and log averages for each repository
    for (const repo of repositories) {
      const [reviewTimes, mergeTimes] = await getGitHubPrMetrics(owner, repo, token, startDate, endDate);
      const avgReviewTime = calculateAverageTime(reviewTimes);
      const avgMergeTime = calculateAverageTime(mergeTimes);

      console.log(`\nCumulative average time for ${repo} pr first review: ${avgReviewTime / 3600} hours`);
      console.log(`Cumulative average time for ${repo} pr merge: ${avgMergeTime / 3600} hours`);
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main();
