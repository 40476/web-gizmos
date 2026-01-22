import os
import json
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

def generate_summary(content):
    """Call OpenRouter API to summarize content."""
    headers = {
        "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You generate stable summaries. "
                    "Only change the summary if the meaning must change. "
                    "Output a short HTML snippet suitable for insertion into a template."
                )
            },
            {
                "role": "user",
                "content": content
            }
        ]
    }

    r = requests.post("https://openrouter.ai/api/v1/chat/completions",
                      headers=headers, data=json.dumps(payload))
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]

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
