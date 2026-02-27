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
            echo "$RESPONSE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['fields']['summary'])" > /tmp/issue_title.txt
            echo "$RESPONSE" | python3 -c "import sys,json,re;d=json.load(sys.stdin);html=(d.get('renderedFields') or {}).get('description') or '';desc=(d.get('fields') or {}).get('description');html=str(desc) if not html and desc else html;print(re.sub('<[^>]+>','',html))" > /tmp/issue_body.txt
          elif [ "$ISSUE_TYPE" = "linear" ]; then
            python3 -c "import json,os;issue=os.environ['ISSUE_NUMBER'];q={'query':'{issue(id:\\"'+issue+'\\"){ title description}}' };f=open('/tmp/linear_query.json','w');json.dump(q,f);f.close()"
            RESPONSE=$(curl -fsSL \\
              -H "Authorization: $LINEAR_API_KEY" \\
              -H "Content-Type: application/json" \\
              -d @/tmp/linear_query.json \\
              "https://api.linear.app/graphql")
            echo "$RESPONSE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['issue']['title'])" > /tmp/issue_title.txt
            echo "$RESPONSE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['issue'].get('description') or '')" > /tmp/issue_body.txt
          fi
          python3 -c "import re;body=open('/tmp/issue_body.txt').read();m=re.search('\\*\\*Prompt Start\\*\\*(.*?)\\*\\*Prompt End\\*\\*',body,re.DOTALL);prompt=m.group(1).strip() if m else body.strip();open('/tmp/prompt.txt','w').write(prompt)"

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
        uses: anthropics/claude-code-base-action@beta
        with:
          prompt_file: /tmp/prompt.txt
          anthropic_api_key: \${{ secrets.CLAUDE_API_KEY }}
          allowed_tools: "Bash,View,GlobTool,GrepTool,Write,Edit,BatchTool"

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
