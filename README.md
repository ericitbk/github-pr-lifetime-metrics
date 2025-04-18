# GitHub PR Lifetime Metrics

This script analyzes GitHub Pull Request (PR) statistics for specified repositories belonging to a GitHub user or organization. For each repository, it calculates the average time taken for key stages in the PR lifecycle, considering all closed PRs since the repository's creation date.

## Metrics Calculated

For each repository listed, the script calculates and logs the following averages (in hours):

1.  **Average Time to First Review:** The average time elapsed between a PR's creation and its first review submission.
2.  **Average Time to Merge:** The average time elapsed between a PR's creation and its merge.
3.  **Average Review Cycle Time:** The average time elapsed between a PR's first review submission and its merge.

The time range for analysis automatically spans from the creation date of each repository up to the moment the script is run.

## Prerequisites

*   Node.js and npm (or yarn)
*   A GitHub Personal Access Token (PAT) with `repo` scope.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ericitbk/github-pr-stats
    cd github-pr-stats
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Create a `.env` file:**
    Copy the `.env.sample` to `.env`:
    ```bash
    cp .env.sample .env
    ```
    Edit the `.env` file and add your GitHub Personal Access Token:
    ```
    GITHUB_TOKEN=your_personal_access_token_here
    ```

## Configuration

Open the `main.ts` file and configure the following variables:

```typescript
// GitHub owner (organization or individual username)
const owner: string = 'your-organization-or-username';

// Array of repositories to analyze under the specified owner
const repositories: string[] = ['repo1', 'repo2', 'repo3'];
```

Replace `'your-organization-or-username'` and the example repository names with your desired targets.

## Running the Script

You can run the script directly using `ts-node` or compile it to JavaScript first.

**Using ts-node:**

```bash
npx ts-node main.ts
```

**Compile and run:**

```bash
# Compile TypeScript to JavaScript (creates main.js)
npx tsc

# Run the compiled JavaScript file
node main.js
```

The script will fetch data from the GitHub API and print the calculated average metrics for each repository to the console. The duration depends on the number of repositories and PRs.

## License

MIT


