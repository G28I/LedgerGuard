/**
 * LedgerGuard PR Code Reviewer Script
 * Runs as part of GitHub Actions workflow via actions/github-script
 */
module.exports = async ({ github, context }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.log('⚠️ OPENROUTER_API_KEY secret is not configured. Skipping AI Code Review.');
    return;
  }

  const { owner, repo, number } = context.issue;

  console.log(`🔍 Fetching changed files for PR #${number} in ${owner}/${repo}...`);

  // Get PR files changed
  const files = await github.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: number,
  });

  const diffSummary = files.data
    .map(f => `File: ${f.filename} (${f.status})\nPatch:\n${f.patch || 'Binary or empty'}`)
    .join('\n\n---\n\n');

  if (!diffSummary) {
    console.log('No diff patches found to review.');
    return;
  }

  const prompt = `You are a Senior Financial Engineering & TypeScript Code Reviewer.
Review the following Pull Request diff for LedgerGuard:

${diffSummary.substring(0, 15000)}

Please analyze and provide a concise review covering:
1. Financial correctness (cents arithmetic, exact monetary precision, append-only source records).
2. TypeScript & architectural quality (strict types, no 'any', Zod schema safety, path aliases).
3. Potential bugs or edge case vulnerabilities.
4. Summary recommendation (APPROVE / REQUEST_CHANGES / COMMENT).`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API call failed with status:', response.status);
      return;
    }

    const data = await response.json();
    const reviewText = data.choices?.[0]?.message?.content || 'No feedback generated.';

    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body: `## 🤖 AI Code Reviewer Feedback\n\n${reviewText}\n\n---\n*Powered by OpenRouter & LedgerGuard AI Controller*`,
    });

    console.log('✅ Successfully posted AI code review comment!');
  } catch (err) {
    console.error('❌ Error executing AI Code Review:', err);
  }
};
