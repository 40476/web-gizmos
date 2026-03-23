import os
import json
import time
import sys
import subprocess
import requests
import re
import argparse
from datetime import datetime
from jinja2 import Template

# Force unbuffered output for live logging
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
    "</section>\n\n"
    "Rules:\n"
    "- Output must contain ONLY standard ASCII characters."
)

def clean_and_truncate_content(content):
    pattern = re.compile(r"//!summaryignore(.*?)//!endsummaryignore", re.DOTALL)
    content = re.sub(pattern, "[Section ignored]", content)
    lines = content.splitlines()
    if len(lines) > 10000:
        lines = lines[:10000]
    return "\n".join([line[:1000] + "... [trunc]" if len(line) > 1000 else line for line in lines])

def dir_changed(path):
    """Checks if the directory changed in the last commit."""
    result = subprocess.run(
        ["git", "diff", "--name-only", "HEAD~1", "HEAD", path],
        capture_output=True, text=True
    )
    return bool(result.stdout.strip())

def generate_summary(content):
    content = content.encode("ascii", "ignore").decode("ascii")
    headers = {
        "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": MODEL,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": content}]
    }
    for attempt in range(3):
        try:
            r = requests.post("https://openrouter.ai/api/v1/chat/completions", 
                             headers=headers, json=payload, timeout=45)
            if r.status_code == 429:
                time.sleep(2 ** attempt)
                continue
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].encode("ascii", "ignore").decode("ascii")
        except Exception as e:
            print(f"API Error: {e}")
            time.sleep(2)
    return ""

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    if 'OPENROUTER_API_KEY' not in os.environ:
        print("::error::Missing OPENROUTER_API_KEY")
        sys.exit(1)

    all_entries = sorted([
        e for e in os.listdir(".")
        if os.path.isdir(e) and not e.startswith(".") and os.path.exists(os.path.join(e, "index.html"))
    ])

    summaries = {}
    to_update = []

    # --- STARTUP PRE-SCAN ---
    print(f"::group::Startup Scan")
    for entry in all_entries:
        summary_file = os.path.join(SUMMARY_DIR, f"{entry}.html")
        needs_api = not os.path.exists(summary_file) or dir_changed(entry)

        if needs_api:
            to_update.append(entry)
            print(f"Queueing for update: {entry}")
        else:
            if os.path.exists(summary_file):
                with open(summary_file, "r", encoding="utf-8") as f:
                    summaries[entry] = f.read()
                print(f"Loaded from cache: {entry}")
    
    print(f"Scan complete. {len(summaries)} cached, {len(to_update)} to update.")
    print("::endgroup::")

    # --- UPDATE LOOP ---
    for i, entry in enumerate(to_update):
        print(f"::notice::Processing {i+1}/{len(to_update)}: {entry}")
        
        with open(os.path.join(entry, "index.html"), "r", encoding="utf-8") as f:
            clean_content = clean_and_truncate_content(f.read())

        if args.dry_run:
            summary = "<section><p>Mocking summary for dry run.</p></section>"
        else:
            summary = generate_summary(clean_content)
        
        if summary and "<section>" in summary:
            with open(os.path.join(SUMMARY_DIR, f"{entry}.html"), "w", encoding="utf-8") as f:
                f.write(summary)
            summaries[entry] = summary
            print(f"Successfully updated {entry}")
        else:
            print(f"::error::Failed to generate valid summary for {entry}")

        if i < len(to_update) - 1:
            print("Waiting 10s for rate limits...")
            time.sleep(10)

    # --- REBUILD ---
    with open(TEMPLATE_FILE, "r", encoding="utf-8") as f:
        template = Template(f.read())
    
    # Alphabetical sorting (case-insensitive)
    sorted_summaries = dict(sorted(summaries.items(), key=lambda item: item[0].lower()))
    
    # Current timestamp for metadata
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")

    new_html = template.render(
        applications=sorted_summaries, 
        last_updated=timestamp
    )

    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            existing_html = f.read()
        
        if existing_html == new_html:
            print("No changes detected in index.html. Exiting.")
            sys.exit(0)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(new_html)
    
    print("Workflow complete. index.html updated.")
    
if __name__ == "__main__":
    main()
