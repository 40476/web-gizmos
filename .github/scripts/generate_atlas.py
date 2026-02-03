import os
import json
from pathlib import Path

ROOT = Path("shared")

def file_attributes(path: Path):
    stats = path.stat()
    return {
        "name": path.name,
        "size": stats.st_size,
        "extension": path.suffix.lstrip(".")
    }

def generate_atlas_for_folder(folder: Path):
    files = [p for p in folder.iterdir() if p.is_file()]

    atlas = [file_attributes(f) for f in files]

    atlas_path = folder / "atlas.json"
    atlas_path.write_text(json.dumps(atlas, indent=2))
    print(f"Generated {atlas_path}")

def main():
    if not ROOT.exists():
        print("No shared/ directory found in repo root.")
        return

    for sub in ROOT.iterdir():
        if sub.is_dir():
            generate_atlas_for_folder(sub)

if __name__ == "__main__":
    main()
