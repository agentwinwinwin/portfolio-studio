import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ContentBundleTest(unittest.TestCase):
    def test_fresh_import_preserves_public_content_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            env = {**os.environ, 'PORTFOLIO_DATA_DIR': directory + '/data', 'PORTFOLIO_UPLOAD_DIR': directory + '/uploads'}
            command = [sys.executable, 'scripts/content_bundle.py', 'import']
            first = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            snapshot = json.loads((ROOT / 'content/site-content.json').read_text())
            with sqlite3.connect(directory + '/data/portfolio.db') as database:
                self.assertEqual(database.execute('SELECT COUNT(*) FROM articles').fetchone()[0], len(snapshot['articles']))
                self.assertEqual(database.execute('SELECT COUNT(*) FROM users').fetchone()[0], 0)
                self.assertEqual(database.execute('SELECT COUNT(*) FROM sessions').fetchone()[0], 0)
            second = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True)
            self.assertNotEqual(second.returncode, 0)
            self.assertIn('Refusing import', second.stderr)

    def test_snapshot_contains_only_public_schema_and_existing_local_images(self):
        snapshot = json.loads((ROOT / 'content/site-content.json').read_text())
        self.assertEqual(set(snapshot), {'schemaVersion', 'articles', 'projects', 'photos', 'materials', 'materialGroups'})
        import re
        for url in re.findall(r'/content-media/[a-zA-Z0-9_.-]+', json.dumps(snapshot)):
            self.assertTrue((ROOT / 'public' / url.lstrip('/')).is_file(), url)
        self.assertNotIn('/api/media/', json.dumps(snapshot))


if __name__ == '__main__':
    unittest.main()
