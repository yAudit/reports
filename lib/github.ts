import { Octokit } from 'octokit';

// Initialize Octokit with your GitHub token
const octokit = new Octokit({
  auth: process.env.GITHUB_ACCESS_TOKEN
});

// Replace these with your GitHub repository details
const REPO_OWNER = 'abdul-majeed-khan';  // Replace with your GitHub username
const REPO_NAME = 'reports-website';  // Should match your repository name
const REPORTS_PATH = 'content/reports';

export async function fetchReportsFromGitHub() {
  try {
    console.log('Fetching reports from GitHub...');
    console.log(`Repository: ${REPO_OWNER}/${REPO_NAME}`);
    console.log(`Path: ${REPORTS_PATH}`);

    // Fetch the list of files in the reports directory
    const { data: contents } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: REPORTS_PATH,
    });

    console.log('Found contents:', contents);

    if (!Array.isArray(contents)) {
      throw new Error('No reports found or reports path is not a directory');
    }

    // Fetch content for each markdown file
    const reports = await Promise.all(
      contents
        .filter(file => file.name.endsWith('.md'))
        .map(async file => {
          console.log(`Fetching content for ${file.name}...`);
          
          const { data: fileData } = await octokit.rest.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: file.path,
          });

          if ('content' in fileData) {
            const content = Buffer.from(fileData.content, 'base64').toString();
            console.log(`Successfully fetched content for ${file.name}`);
            return {
              name: file.name,
              path: file.path,
              content,
              sha: file.sha
            };
          }
          console.log(`No content found for ${file.name}`);
          return null;
        })
    );

    const validReports = reports.filter(Boolean);
    console.log(`Successfully fetched ${validReports.length} reports`);
    return validReports;
  } catch (error) {
    console.error('Error fetching reports:', error);
    throw error;
  }
}

export async function getLatestCommit() {
  try {
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: REPORTS_PATH,
      per_page: 1
    });

    return commits[0]?.sha;
  } catch (error) {
    console.error('Error fetching latest commit:', error);
    throw error;
  }
}