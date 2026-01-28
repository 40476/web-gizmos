import os
import json
import time
import subprocess
import requests
import re
from jinja2 import Template

MODEL = "qwen/qwen3-next-80b-a3b-instruct:free"
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
    "- Do NOT include Markdown.\n"
    "- Do NOT rewrite or restyle the original HTML.\n"
    "- Do NOT include full code blocks or long excerpts.\n"
    "- Code lines must be short (max 80 chars) and taken from the input.\n"
    "- Keep the summary stable; only change it when the meaning must change.\n"
    "- Do NOT include any non-English words or characters.\n"
    "- Do NOT include stray Unicode symbols.\n"
    "- Output must contain ONLY standard ASCII characters."
)

# ------------------------------------------------------------
# GitHub Actions logging helpers
# ------------------------------------------------------------
def gha_notice(msg):
    print(f"::notice::{msg}")

def gha_group(msg):
    print(f"::group::{msg}")

def gha_endgroup():
    print("::endgroup::")

# ------------------------------------------------------------
# Directory change detection
# ------------------------------------------------------------
def dir_changed(path):
    """Return True if the directory has changed since last commit."""
    result = subprocess.run(
        ["git", "diff", "--name-only", "HEAD~1", "HEAD", path],
        capture_output=True,
        text=True
    )
    return bool(result.stdout.strip())

# ------------------------------------------------------------
# Summary validator
# ------------------------------------------------------------
def validate_summary(summary):
    if "<section>" not in summary or "</section>" not in summary:
        return False
    if summary.count("<li>") < 3:
        return False
    if summary.count("<code>") < 2:
        return False
    if "<p>" not in summary or "</p>" not in summary:
        return False

    # Check for 3 sentences inside <p>
    p_match = re.search(r"<p>(.*?)</p>", summary, re.DOTALL)
    if not p_match:
        return False

    sentences = re.split(r"[.!?]\s+", p_match.group(1).strip())
    if len([s for s in sentences if s.strip()]) < 3:
        return False

    return True

# ------------------------------------------------------------
# OpenRouter API call with retry + backoff
# ------------------------------------------------------------
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
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content}
        ]
    }

    for attempt in range(6):
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            data=json.dumps(payload)
        )

        # Rate limit
        if r.status_code == 429:
            wait = 2 ** attempt
            gha_notice(f"Rate limited. Waiting {wait} seconds...")
            time.sleep(wait)
            continue

        # Other errors
        if r.status_code >= 400:
            gha_notice(f"OpenRouter error: {r.text}")
            if attempt < 5:
                time.sleep(2)
                continue
            r.raise_for_status()

        data = r.json()

        # Missing choices = invalid response
        if "choices" not in data:
            gha_notice(f"Invalid response (no 'choices'): {data}")
            if attempt < 5:
                time.sleep(2)
                continue
            raise RuntimeError("OpenRouter returned no choices after retries.")

        # Log raw LLM output
        gha_group("LLM raw output")
        print(data["choices"][0]["message"]["content"])
        gha_endgroup()

        return data["choices"][0]["message"]["content"]

    raise RuntimeError("Failed after multiple retries.")

# ------------------------------------------------------------
# Template rendering
# ------------------------------------------------------------
def load_template():
    with open(TEMPLATE_FILE, "r", encoding="utf-8") as f:
        return Template(f.read())

def write_root_index(summaries):
    template = load_template()
    rendered = template.render(applications=summaries)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(rendered)

# ------------------------------------------------------------
# Main
# ------------------------------------------------------------
def main():
    summaries = {}
    retry_queue = []

    # Collect valid directories
    entries = [
        e for e in os.listdir(".")
        if os.path.isdir(e)
        and not e.startswith(".")
        and os.path.exists(os.path.join(e, "index.html"))
        and not os.path.exists(os.path.join(e, ".summaryignore"))
    ]

    total = len(entries)
    completed = 0

    for entry in entries:
        completed += 1
        gha_notice(f"Starting summary {completed}/{total}: {entry}")
        gha_group(f"Processing {entry}")

        index_file = os.path.join(entry, "index.html")
        summary_file = os.path.join(SUMMARY_DIR, f"{entry}.html")

        # Cache check
        if os.path.exists(summary_file) and not dir_changed(entry):
            gha_notice(f"Using cached summary for {entry}")
            with open(summary_file, "r", encoding="utf-8") as f:
                summaries[entry] = f.read()
            gha_endgroup()
            continue

        # Generate new summary
        with open(index_file, "r", encoding="utf-8") as f:
            content = f.read()

        summary = generate_summary(content)

        # Validate
        if not validate_summary(summary):
            gha_notice(f"Validation failed for {entry}, adding to retry queue.")
            retry_queue.append(entry)
        else:
            gha_notice(f"Validation passed for {entry}.")
            with open(summary_file, "w", encoding="utf-8") as f:
                f.write(summary)
            summaries[entry] = summary

        gha_endgroup()
        time.sleep(10)  # queue delay

    # Retry pass
    if retry_queue:
        gha_notice(f"Retrying {len(retry_queue)} failed summaries...")

        for entry in retry_queue:
            gha_group(f"Retrying {entry}")

            index_file = os.path.join(entry, "index.html")
            with open(index_file, "r", encoding="utf-8") as f:
                content = f.read()

            summary = generate_summary(content)

            if validate_summary(summary):
                gha_notice(f"Retry succeeded for {entry}.")
                with open(os.path.join(SUMMARY_DIR, f"{entry}.html"), "w", encoding="utf-8") as f:
                    f.write(summary)
                summaries[entry] = summary
            else:
                gha_notice(f"Final failure for {entry}, leaving old summary unchanged.")

            gha_endgroup()
            time.sleep(10)

    gha_notice("All summaries complete. Rebuilding index.html.")
    write_root_index(summaries)

if __name__ == "__main__":
    main()
