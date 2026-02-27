// GitHub Actions workflow installed into .github/workflows/remote-run.yml.
// Used by the Remote Run feature in the IDE.

export const REMOTE_RUN_YAML_CONTENT = `name: Remote Run
on:
  workflow_dispatch:
    inputs:
      issue_number:
        description: 'Issue number or identifier (e.g. 42, LIN-456, PROJ-123)'
        required: true
        type: string
      issue_type:
        description: 'Issue source'
        required: true
        type: choice
        options:
          - github
          - jira
          - linear

jobs:
  remote-run:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: \${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Claude Code CLI
        run: npm install -g @anthropic-ai/claude-code

      - name: Fetch issue and extract prompt
        id: issue
        env:
          ISSUE_NUMBER: \${{ inputs.issue_number }}
          ISSUE_TYPE: \${{ inputs.issue_type }}
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          JIRA_BASE_URL: \${{ secrets.JIRA_BASE_URL }}
          JIRA_EMAIL: \${{ secrets.JIRA_EMAIL }}
          JIRA_API_TOKEN: \${{ secrets.JIRA_API_TOKEN }}
          LINEAR_API_KEY: \${{ secrets.LINEAR_API_KEY }}
        run: |
          set -e
          if [ "$ISSUE_TYPE" = "github" ]; then
            gh issue view "$ISSUE_NUMBER" --json title -q '.title' > /tmp/issue_title.txt
            gh issue view "$ISSUE_NUMBER" --json body -q '.body' > /tmp/issue_body.txt
          elif [ "$ISSUE_TYPE" = "jira" ]; then
            RESPONSE=$(curl -fsSL -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \\
              "$JIRA_BASE_URL/rest/api/3/issue/$ISSUE_NUMBER?expand=renderedFields")
            echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d['fields']['summary'])
" > /tmp/issue_title.txt
            echo "$RESPONSE" | python3 -c "
import sys, json, re
d = json.load(sys.stdin)
html = (d.get('renderedFields') or {}).get('description') or ''
if not html:
    desc = (d.get('fields') or {}).get('description')
    html = str(desc) if desc else ''
text = re.sub(r'<[^>]+>', '', html)
print(text)
" > /tmp/issue_body.txt
          elif [ "$ISSUE_TYPE" = "linear" ]; then
            python3 << 'PYEOF_QUERY'
import json, os
issue = os.environ['ISSUE_NUMBER']
query = {'query': '{ issues(filter:{identifier:{eq:"' + issue + '"}}) { nodes { title description } } }'}
with open('/tmp/linear_query.json', 'w') as f:
    json.dump(query, f)
PYEOF_QUERY
            RESPONSE=$(curl -fsSL \\
              -H "Authorization: $LINEAR_API_KEY" \\
              -H "Content-Type: application/json" \\
              -d @/tmp/linear_query.json \\
              "https://api.linear.app/graphql")
            echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
node = d['data']['issues']['nodes'][0]
print(node['title'])
" > /tmp/issue_title.txt
            echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
node = d['data']['issues']['nodes'][0]
print(node.get('description') or '')
" > /tmp/issue_body.txt
          fi
          python3 - <<'PYEOF'
import re
with open('/tmp/issue_body.txt') as f:
    body = f.read()
m = re.search(r'\\*\\*Prompt Start\\*\\*(.*?)\\*\\*Prompt End\\*\\*', body, re.DOTALL)
prompt = m.group(1).strip() if m else body.strip()
with open('/tmp/prompt.txt', 'w') as f:
    f.write(prompt)
PYEOF

      - name: Configure git
        run: |
          git config user.email "remote-run[bot]@users.noreply.github.com"
          git config user.name "Remote Run"

      - name: Create branch
        run: |
          BRANCH="remote-run/$(echo "\${{ inputs.issue_number }}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')"
          git checkout -b "$BRANCH"
          echo "BRANCH=$BRANCH" >> "$GITHUB_ENV"

      - name: Run Claude Code
        env:
          ANTHROPIC_API_KEY: \${{ secrets.CLAUDE_API_KEY }}
        run: claude --dangerously-skip-permissions -p "$(cat /tmp/prompt.txt)"

      - name: Commit and open PR
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          git add -A
          if git diff --staged --quiet; then
            echo "No changes produced — skipping commit and PR."
            exit 0
          fi
          git commit -m "feat: $(cat /tmp/issue_title.txt)"
          git push origin "$BRANCH"
          gh pr create \\
            --title "feat: $(cat /tmp/issue_title.txt)" \\
            --body "Automated remote run from \${{ inputs.issue_type }} \${{ inputs.issue_number }}." \\
            --head "$BRANCH"
`;
