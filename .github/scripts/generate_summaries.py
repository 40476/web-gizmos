import os
import time
import sys
import subprocess
import requests
import re
import argparse
from datetime import datetime
from jinja2 import Template

sys.stdout.reconfigure(line_buffering=True)

MODEL = "arcee-ai/trinity-large-preview:free"
SUMMARY_DIR = ".github/summaries"
TEMPLATE_FILE = "index.html.template"
OUTPUT_FILE = "index.html"

os.makedirs(SUMMARY_DIR, exist_ok=True)

SYSTEM_PROMPT = (
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
    "</section>\n"
)

def clean_and_truncate_content(content):
    pattern = re.compile(r"//!summaryignore(.*?)//!endsummaryignore", re.DOTALL)
    content = re.sub(pattern, "[Section ignored]", content)
    lines = content.splitlines()
    if len(lines) > 5000:
        lines = lines[:5000]
    return "\n".join([line[:500] for line in lines])

def dir_changed(path):
    result = subprocess.run(["git", "diff", "--name-only", "HEAD~1", "HEAD", path], capture_output=True, text=True)
    return bool(result.stdout.strip())

def generate_summary(content):
    content = content.encode("ascii", "ignore").decode("ascii")
    headers = {"Authorization": f"Bearer {os.environ.get('OPENROUTER_API_KEY', '')}", "Content-Type": "application/json"}
    payload = {"model": MODEL, "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": content}]}
    try:
        r = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=40)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"Error: {e}")
        return ""

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    # Get all subdirectories containing index.html
    all_entries = sorted([
        e for e in os.listdir(".")
        if os.path.isdir(e) and not e.startswith(".") and os.path.exists(os.path.join(e, "index.html"))
    ], key=lambda s: s.lower())

    summaries = {}
    
    for entry in all_entries:
        summary_file = os.path.join(SUMMARY_DIR, f"{entry}.html")
        
        if not os.path.exists(summary_file) or dir_changed(entry):
            print(f"Updating: {entry}")
            with open(os.path.join(entry, "index.html"), "r", encoding="utf-8") as f:
                content = clean_and_truncate_content(f.read())
            
            res = "<section><p>Dry run summary.</p></section>" if args.dry_run else generate_summary(content)
            if res:
                with open(summary_file, "w", encoding="utf-8") as f:
                    f.write(res)
                summaries[entry] = res
                if not args.dry_run: time.sleep(5) # Basic rate limit
        else:
            with open(summary_file, "r", encoding="utf-8") as f:
                summaries[entry] = f.read()

    # Rebuild Template
    with open(TEMPLATE_FILE, "r", encoding="utf-8") as f:
        template = Template(f.read())
    
    # Sort summaries by key case-insensitive for the template render
    sorted_summaries = dict(sorted(summaries.items(), key=lambda x: x[0].lower()))
    
    html = template.render(
        applications=sorted_summaries,
        last_updated=datetime.now().strftime("%b %d, %Y - %H:%M")
    )

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)
    print("Done!")

if __name__ == "__main__":
    main()
