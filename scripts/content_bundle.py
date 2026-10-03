"""Export public content only; import into a fresh local installation."""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend import app as api

SNAPSHOT = ROOT / 'content/site-content.json'
MEDIA = ROOT / 'public/content-media'


def export_content():
    if not api.DATABASE_PATH.exists():
        raise SystemExit('No database to export; start the backend first.')
    content = api.get_content()
    serialized = json.dumps(content, ensure_ascii=False, indent=2)
    filenames = sorted(set(re.findall(r'/api/media/([a-zA-Z0-9_-]+\.(?:webp|png|jpg|jpeg|gif))', serialized)))
    # Validate all references before modifying the snapshot.
    for filename in filenames:
        if not (api.UPLOAD_DIR / filename).is_file():
            raise SystemExit(f'Missing referenced image: {filename}')
    MEDIA.mkdir(parents=True, exist_ok=True)
    for filename in filenames:
        shutil.copy2(api.UPLOAD_DIR / filename, MEDIA / filename)
        serialized = serialized.replace('/api/media/' + filename, '/content-media/' + filename)
    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT.write_text(serialized + '\n', encoding='utf-8')
    print(f'Exported {len(content["articles"])} articles, {len(content["projects"])} projects, {len(filenames)} referenced images. No credentials or sessions exported.')


def import_content():
    payload = api.ContentPayload.model_validate_json(SNAPSHOT.read_text(encoding='utf-8'))
    if any(api.UPLOAD_DIR.iterdir()):
        raise SystemExit('Refusing import: upload directory is not empty.')
    if api.DATABASE_PATH.exists():
        with api.connect() as database:
            tables = {r['name'] for r in database.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            for table in tables & {'users', 'sessions', 'articles', 'projects', 'photos', 'materials', 'material_groups'}:
                if database.execute(f'SELECT 1 FROM {table} LIMIT 1').fetchone():
                    raise SystemExit('Refusing import: database already contains content or authentication data.')
    api.init_database()
    # Local offline import, never an HTTP authentication bypass.
    api.replace_content(payload, True)
    print(f'Imported {len(payload.articles)} articles. Set up your own administrator separately.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['export', 'import'])
    args = parser.parse_args()
    export_content() if args.operation == 'export' else import_content()
