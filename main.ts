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
): Promise<[number[], number[], number[]]> {
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
  const reviewCycleTimes: number[] = [];

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

        if (mergedAt) {
          reviewCycleTimes.push((mergedAt.getTime() - firstReviewTime.getTime()) / 1000);
        }
      }
    }
  }

  return [reviewTimes, mergeTimes, reviewCycleTimes];
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

  try {
    const headers = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // Calculate and log averages for each repository using its lifetime
    for (const repo of repositories) {
      // Fetch repository details to get its creation date
      const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
      const repoResponse = await fetch(repoUrl, { headers });

      if (!repoResponse.ok) {
        if (repoResponse.status === 404) {
          console.log(`\nRepository not found: ${repo}. Skipping.`);
          continue; // Skip to the next repository
        } else {
          // Throw error for other issues
          throw new Error(`HTTP error fetching repo details for ${repo}! status: ${repoResponse.status}`);
        }
      }

      const repoDetails = await repoResponse.json();
      const startDate = new Date(repoDetails.created_at); // Use repo creation date as start
      const endDate = new Date(); // Use current time as end date

      // Fetch metrics for this specific repository using its lifetime dates
      const [reviewTimes, mergeTimes, reviewCycleTimes] = await getGitHubPrMetrics(owner, repo, token, startDate, endDate);

      if (reviewTimes.length === 0 && mergeTimes.length === 0 && reviewCycleTimes.length === 0) {
          console.log(`No pull requests found within the specified lifetime for ${repo}.`);
          continue;
      }

      const avgReviewTime = calculateAverageTime(reviewTimes);
      const avgMergeTime = calculateAverageTime(mergeTimes);
      const avgReviewCycleTime = calculateAverageTime(reviewCycleTimes);

      console.log(` Metrics for repository: ${repo} (from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})` );
      console.log(`  Average time to first review: ${(avgReviewTime / 3600).toFixed(2)} hours`);
      console.log(`  Average time to merge: ${(avgMergeTime / 3600).toFixed(2)} hours`);
      console.log(`  Average review cycle time (first review to merge): ${(avgReviewCycleTime / 3600).toFixed(2)} hours`);
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main();
