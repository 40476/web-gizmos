import os
import json
import time
import subprocess
import requests
from jinja2 import Template

MODEL = "qwen/qwen3-coder:free"   # Hardcoded model
SUMMARY_DIR = ".github/summaries"
TEMPLATE_FILE = "index.html.template"
OUTPUT_FILE = "index.html"

os.makedirs(SUMMARY_DIR, exist_ok=True)

def dir_changed(path):
    """Return True if the directory has changed since last commit."""
    result = subprocess.run(
        ["git", "diff", "--name-only", "HEAD~1", "HEAD", path],
        capture_output=True,
        text=True
    )
    return bool(result.stdout.strip())

import time
import json
import requests

def generate_summary(content):
    content = content.encode("utf-8", "replace").decode("utf-8")

    headers = {
        "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
        "Content-Type": "application/json",
        "X-Title": "summary-generator"
    }

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You generate stable, minimal summaries for small web applications.\n"
                    "Follow this format exactly, using ONLY HTML:\n\n"
                    "<section>\n"
                    "  <ul>\n"
                    "    <li>[bullet point 1]</li>\n"
                    "    <li>[bullet point 2]</li>\n"
                    "    <li>[bullet point 3]</li>\n"
                    "  </ul>\n\n"
                    "  <pre>\n"
                    "    <code>[short code line 1]</code>\n"
                    "    <code>[short code line 2]</code>\n"
                    "  </pre>\n\n"
                    "  <p>[Three-sentence summary here.]</p>\n"
                    "</section>\n\n"
                    "Rules:\n"
                    "- Do NOT include Markdown.\n"
                    "- Do NOT rewrite or restyle the original HTML.\n"
                    "- Do NOT include full code blocks or long excerpts.\n"
                    "- Code lines must be short (max 80 chars) and taken from the input.\n"
                    "- Keep the summary stable; only change it when the meaning must change."
                )
            },
            {
                "role": "user",
                "content": content
            }
        ]
    }
    

    # Retry up to 5 times with exponential backoff
    for attempt in range(5):
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            data=json.dumps(payload)
        )

        if r.status_code == 429:
            wait = 2 ** attempt
            print(f"Rate limited. Waiting {wait} seconds...")
            time.sleep(wait)
            continue

        if r.status_code >= 400:
            print("OpenRouter error:", r.text)
            r.raise_for_status()

        return r.json()["choices"][0]["message"]["content"]

    raise RuntimeError("Failed after multiple retries due to rate limits.")

def load_template():
    with open(TEMPLATE_FILE, "r", encoding="utf-8") as f:
        return Template(f.read())

def write_root_index(summaries):
    template = load_template()
    rendered = template.render(applications=summaries)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(rendered)

def main():
    summaries = {}

    for entry in os.listdir("."):
        if entry.startswith("."):
            continue
        if not os.path.isdir(entry):
            continue

        summary_ignore = os.path.join(entry, ".summaryignore")
        if os.path.exists(summary_ignore):
            continue

        index_file = os.path.join(entry, "index.html")
        if not os.path.exists(index_file):
            continue

        summary_file = os.path.join(SUMMARY_DIR, f"{entry}.html")

        # Only regenerate if directory changed or summary missing
        if not os.path.exists(summary_file) or dir_changed(entry):
            with open(index_file, "r", encoding="utf-8") as f:
                content = f.read()

            print(f"Generating summary for {entry}...")
            summary = generate_summary(content)

            with open(summary_file, "w", encoding="utf-8") as f:
                f.write(summary)
        else:
            with open(summary_file, "r", encoding="utf-8") as f:
                summary = f.read()

        summaries[entry] = summary

    write_root_index(summaries)

if __name__ == "__main__":
    main()
