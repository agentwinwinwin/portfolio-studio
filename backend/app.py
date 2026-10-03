import hashlib
import hmac
import io
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import Cookie, Depends, FastAPI, File, HTTPException, Response, UploadFile
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv('PORTFOLIO_DATA_DIR', ROOT / 'data'))
UPLOAD_DIR = Path(os.getenv('PORTFOLIO_UPLOAD_DIR', ROOT / 'uploads'))
DATABASE_PATH = DATA_DIR / 'portfolio.db'
SESSION_DAYS = 7
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
COOKIE_SECURE = os.getenv('COOKIE_SECURE', '').lower() in {'1', 'true', 'yes'}
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title='Portfolio CMS API', version='1.0.0')
app.mount('/api/media', StaticFiles(directory=UPLOAD_DIR), name='media')


class AuthPayload(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)


class Article(BaseModel):
    id: str
    title: str
    excerpt: str = ''
    body: str = ''
    tags: List[str] = Field(default_factory=list)
    date: str = ''
    cover: str = ''
    screenshots: List[str] = Field(default_factory=list)
    createdAt: str = ''


class Project(BaseModel):
    id: str
    title: str
    subtitle: str = ''
    description: str = ''
    body: str = ''
    screenshots: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    metric: str = ''
    href: str = ''
    image: str = ''
    createdAt: str = ''


class Photo(BaseModel):
    id: str
    title: str = ''
    image: str
    alt: str = ''
    createdAt: str = ''


class Material(BaseModel):
    id: str
    title: str = ''
    image: str
    alt: str = ''
    groupId: str = 'seed-material-group-01'
    createdAt: str = ''


class MaterialGroup(BaseModel):
    id: str
    name: str
    createdAt: str = ''


class ContentPayload(BaseModel):
    schemaVersion: int = 6
    articles: List[Article] = Field(default_factory=list)
    projects: List[Project] = Field(default_factory=list)
    photos: List[Photo] = Field(default_factory=list)
    materials: List[Material] = Field(default_factory=list)
    materialGroups: List[MaterialGroup] = Field(default_factory=list)


SEED_PROJECTS = []
SEED_PHOTOS = []
SEED_MATERIALS = []
SEED_MATERIAL_GROUPS = [('seed-material-group-01', '示例素材')]


def utc_now():
    return datetime.now(timezone.utc)


def connect():
    database = sqlite3.connect(DATABASE_PATH, timeout=10)
    database.row_factory = sqlite3.Row
    database.execute('PRAGMA foreign_keys = ON')
    database.execute('PRAGMA journal_mode = WAL')
    database.execute('PRAGMA busy_timeout = 5000')
    return database


def init_database():
    with connect() as database:
        database.executescript('''
            CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY CHECK (id = 1), username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, title TEXT NOT NULL, excerpt TEXT NOT NULL, body TEXT NOT NULL, tags TEXT NOT NULL, publish_date TEXT NOT NULL, cover TEXT NOT NULL, screenshots TEXT NOT NULL, created_at TEXT NOT NULL, position INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, title TEXT NOT NULL, subtitle TEXT NOT NULL, description TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', screenshots TEXT NOT NULL DEFAULT '[]', tags TEXT NOT NULL, metric TEXT NOT NULL, href TEXT NOT NULL, image TEXT NOT NULL, created_at TEXT NOT NULL, position INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, title TEXT NOT NULL, image TEXT NOT NULL, alt TEXT NOT NULL, created_at TEXT NOT NULL, position INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS material_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, position INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, title TEXT NOT NULL, image TEXT NOT NULL, alt TEXT NOT NULL, group_id TEXT NOT NULL DEFAULT 'seed-material-group-01', created_at TEXT NOT NULL, position INTEGER NOT NULL);
            CREATE INDEX IF NOT EXISTS idx_articles_position ON articles(position);
            CREATE INDEX IF NOT EXISTS idx_projects_position ON projects(position);
            CREATE INDEX IF NOT EXISTS idx_photos_position ON photos(position);
            CREATE INDEX IF NOT EXISTS idx_materials_position ON materials(position);
            CREATE INDEX IF NOT EXISTS idx_material_groups_position ON material_groups(position);
            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
        ''')
        user_columns = {row['name'] for row in database.execute('PRAGMA table_info(users)')}
        if 'username' not in user_columns:
            database.execute("ALTER TABLE users ADD COLUMN username TEXT NOT NULL DEFAULT 'developer'")
        database.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)')
        project_columns = {row['name'] for row in database.execute('PRAGMA table_info(projects)')}
        if 'body' not in project_columns:
            database.execute("ALTER TABLE projects ADD COLUMN body TEXT NOT NULL DEFAULT ''")
        if 'screenshots' not in project_columns:
            database.execute("ALTER TABLE projects ADD COLUMN screenshots TEXT NOT NULL DEFAULT '[]'")
        seed_row = database.execute("SELECT value FROM metadata WHERE key = 'seed_version'").fetchone()
        seed_version = int(seed_row['value']) if seed_row else 0
        if seed_version < 1:
            timestamp = '2026-09-27T00:00:00.000Z'
            for position, item in enumerate(SEED_PROJECTS):
                database.execute(
                    'INSERT OR IGNORE INTO projects(id, title, subtitle, description, tags, metric, href, image, created_at, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    (item[0], item[1], item[2], item[3], json.dumps(item[4], ensure_ascii=False), item[5], item[6], '', timestamp, position),
                )
            for position, item in enumerate(SEED_PHOTOS):
                database.execute('INSERT OR IGNORE INTO photos VALUES (?, ?, ?, ?, ?, ?)', (*item, timestamp, position))
        if seed_version < 2:
            timestamp = '2026-09-28T00:00:00.000Z'
            for position, item in enumerate(SEED_MATERIALS):
                database.execute('INSERT OR IGNORE INTO materials(id, title, image, alt, created_at, position) VALUES (?, ?, ?, ?, ?, ?)', (*item, timestamp, position))
        if seed_version < 3:
            timestamp = '2026-09-28T00:00:00.000Z'
            columns = {row['name'] for row in database.execute('PRAGMA table_info(materials)')}
            if 'group_id' not in columns:
                database.execute("ALTER TABLE materials ADD COLUMN group_id TEXT NOT NULL DEFAULT 'seed-material-group-01'")
            for position, item in enumerate(SEED_MATERIAL_GROUPS):
                database.execute('INSERT OR IGNORE INTO material_groups VALUES (?, ?, ?, ?)', (*item, timestamp, position))
            database.execute("UPDATE materials SET group_id = 'seed-material-group-01' WHERE group_id = '' OR group_id IS NULL")
            database.execute("INSERT INTO metadata(key, value) VALUES ('seed_version', '3') ON CONFLICT(key) DO UPDATE SET value = '3'")
        valid_group_ids = {row['id'] for row in database.execute('SELECT id FROM material_groups')}
        fallback_group = next(iter(valid_group_ids), 'seed-material-group-01')
        for row in database.execute('SELECT id, created_at, position, group_id FROM materials').fetchall():
            if row['group_id'] in valid_group_ids:
                continue
            # Older SQLite files appended group_id at the end of the table. A previous
            # positional INSERT could therefore rotate these three values; recover them.
            if row['created_at'] in valid_group_ids and isinstance(row['position'], str) and 'T' in row['position']:
                recovered_position = int(row['group_id']) if str(row['group_id']).isdigit() else 0
                database.execute(
                    'UPDATE materials SET created_at = ?, position = ?, group_id = ? WHERE id = ?',
                    (row['position'], recovered_position, row['created_at'], row['id']),
                )
            else:
                database.execute('UPDATE materials SET group_id = ? WHERE id = ?', (fallback_group, row['id']))


def password_digest(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 310_000).hex()


def set_credentials(username, password):
    salt = secrets.token_hex(16)
    with connect() as database:
        database.execute(
            '''INSERT INTO users(id, username, password_hash, salt, created_at) VALUES (1, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET username = excluded.username, password_hash = excluded.password_hash, salt = excluded.salt''',
            (username, password_digest(password, salt), salt, utc_now().isoformat()),
        )
        database.execute('DELETE FROM sessions')


def session_user(dev_session: Optional[str] = Cookie(default=None)):
    if not dev_session:
        raise HTTPException(status_code=401, detail='请先登录开发者模式')
    token_hash = hashlib.sha256(dev_session.encode()).hexdigest()
    with connect() as database:
        row = database.execute('SELECT expires_at FROM sessions WHERE token_hash = ?', (token_hash,)).fetchone()
        if not row or datetime.fromisoformat(row['expires_at']) <= utc_now():
            if row:
                database.execute('DELETE FROM sessions WHERE token_hash = ?', (token_hash,))
            raise HTTPException(status_code=401, detail='登录已过期')
    return True


def create_session(response):
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    now = utc_now()
    expires = now + timedelta(days=SESSION_DAYS)
    with connect() as database:
        database.execute('DELETE FROM sessions WHERE expires_at <= ?', (now.isoformat(),))
        database.execute('INSERT INTO sessions VALUES (?, ?, ?)', (token_hash, expires.isoformat(), now.isoformat()))
    response.set_cookie('dev_session', token, max_age=SESSION_DAYS * 86400, httponly=True, samesite='lax', secure=COOKIE_SECURE, path='/')


def cleanup_unused_uploads(payload):
    urls = []
    for article in payload.articles:
        urls.extend([article.cover, *article.screenshots])
    urls.extend(project.image for project in payload.projects)
    for project in payload.projects:
        urls.extend(project.screenshots)
    urls.extend(photo.image for photo in payload.photos)
    urls.extend(material.image for material in payload.materials)
    used = {Path(url).name for url in urls if url.startswith('/api/media/')}
    for image_path in UPLOAD_DIR.glob('*.webp'):
        if image_path.name not in used:
            image_path.unlink(missing_ok=True)


@app.on_event('startup')
def startup():
    init_database()
    configured_password = os.getenv('ADMIN_PASSWORD')
    configured_username = os.getenv('ADMIN_USERNAME', 'developer')
    if configured_password:
        with connect() as database:
            has_user = database.execute('SELECT 1 FROM users LIMIT 1').fetchone()
        if not has_user:
            set_credentials(configured_username, configured_password)


@app.get('/api/health')
def health():
    return {'status': 'ok', 'database': DATABASE_PATH.name}


@app.get('/api/auth/status')
def auth_status(dev_session: Optional[str] = Cookie(default=None)):
    with connect() as database:
        setup_required = not bool(database.execute('SELECT 1 FROM users LIMIT 1').fetchone())
    authenticated = False
    if dev_session:
        try:
            session_user(dev_session)
            authenticated = True
        except HTTPException:
            pass
    return {'authenticated': authenticated, 'setupRequired': setup_required}


@app.post('/api/auth/setup')
def auth_setup(payload: AuthPayload, response: Response):
    with connect() as database:
        if database.execute('SELECT 1 FROM users LIMIT 1').fetchone():
            raise HTTPException(status_code=409, detail='开发者密码已设置')
    set_credentials(payload.username, payload.password)
    create_session(response)
    return {'authenticated': True}


@app.post('/api/auth/login')
def auth_login(payload: AuthPayload, response: Response):
    with connect() as database:
        user = database.execute('SELECT username, password_hash, salt FROM users WHERE id = 1').fetchone()
    valid_username = bool(user) and hmac.compare_digest(payload.username, user['username'])
    valid_password = bool(user) and hmac.compare_digest(password_digest(payload.password, user['salt']), user['password_hash'])
    if not valid_username or not valid_password:
        raise HTTPException(status_code=401, detail='账号或密码不正确')
    create_session(response)
    return {'authenticated': True}


@app.post('/api/auth/logout')
def auth_logout(response: Response, dev_session: Optional[str] = Cookie(default=None)):
    if dev_session:
        with connect() as database:
            database.execute('DELETE FROM sessions WHERE token_hash = ?', (hashlib.sha256(dev_session.encode()).hexdigest(),))
    response.delete_cookie('dev_session', path='/')
    return {'authenticated': False}


@app.get('/api/content')
def get_content():
    with connect() as database:
        articles = [{'id': r['id'], 'title': r['title'], 'excerpt': r['excerpt'], 'body': r['body'], 'tags': json.loads(r['tags']), 'date': r['publish_date'], 'cover': r['cover'], 'screenshots': json.loads(r['screenshots']), 'createdAt': r['created_at']} for r in database.execute('SELECT * FROM articles ORDER BY position')]
        projects = [{'id': r['id'], 'title': r['title'], 'subtitle': r['subtitle'], 'description': r['description'], 'body': r['body'], 'screenshots': json.loads(r['screenshots']), 'tags': json.loads(r['tags']), 'metric': r['metric'], 'href': r['href'], 'image': r['image'], 'createdAt': r['created_at']} for r in database.execute('SELECT * FROM projects ORDER BY position')]
        photos = [{'id': r['id'], 'title': r['title'], 'image': r['image'], 'alt': r['alt'], 'createdAt': r['created_at']} for r in database.execute('SELECT * FROM photos ORDER BY position')]
        materials = [{'id': r['id'], 'title': r['title'], 'image': r['image'], 'alt': r['alt'], 'groupId': r['group_id'], 'createdAt': r['created_at']} for r in database.execute('SELECT * FROM materials ORDER BY position')]
        material_groups = [{'id': r['id'], 'name': r['name'], 'createdAt': r['created_at']} for r in database.execute('SELECT * FROM material_groups ORDER BY position')]
    return {'schemaVersion': 6, 'articles': articles, 'projects': projects, 'photos': photos, 'materials': materials, 'materialGroups': material_groups}


@app.put('/api/content')
def replace_content(payload: ContentPayload, _: bool = Depends(session_user)):
    with connect() as database:
        database.execute('DELETE FROM articles')
        database.execute('DELETE FROM projects')
        database.execute('DELETE FROM photos')
        database.execute('DELETE FROM materials')
        database.execute('DELETE FROM material_groups')
        for position, item in enumerate(payload.articles):
            database.execute('INSERT INTO articles VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', (item.id, item.title, item.excerpt, item.body, json.dumps(item.tags, ensure_ascii=False), item.date, item.cover, json.dumps(item.screenshots, ensure_ascii=False), item.createdAt or utc_now().isoformat(), position))
        for position, item in enumerate(payload.projects):
            database.execute(
                'INSERT INTO projects(id, title, subtitle, description, body, screenshots, tags, metric, href, image, created_at, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (item.id, item.title, item.subtitle, item.description, item.body, json.dumps(item.screenshots, ensure_ascii=False), json.dumps(item.tags, ensure_ascii=False), item.metric, item.href, item.image, item.createdAt or utc_now().isoformat(), position),
            )
        for position, item in enumerate(payload.photos):
            database.execute('INSERT INTO photos VALUES (?, ?, ?, ?, ?, ?)', (item.id, item.title, item.image, item.alt, item.createdAt or utc_now().isoformat(), position))
        groups = payload.materialGroups or [MaterialGroup(id='seed-material-group-01', name='默认素材')]
        for position, item in enumerate(groups):
            database.execute('INSERT INTO material_groups VALUES (?, ?, ?, ?)', (item.id, item.name, item.createdAt or utc_now().isoformat(), position))
        valid_groups = {item.id for item in groups}
        fallback_group = groups[0].id
        for position, item in enumerate(payload.materials):
            group_id = item.groupId if item.groupId in valid_groups else fallback_group
            database.execute(
                'INSERT INTO materials(id, title, image, alt, group_id, created_at, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
                (item.id, item.title, item.image, item.alt, group_id, item.createdAt or utc_now().isoformat(), position),
            )
    cleanup_unused_uploads(payload)
    return get_content()


@app.post('/api/uploads')
async def upload_image(file: UploadFile = File(...), _: bool = Depends(session_user)):
    if file.content_type not in {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}:
        raise HTTPException(status_code=415, detail='仅支持 JPG、PNG、WebP 和 GIF 图片')
    payload = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail='单张图片不能超过 12MB')
    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(payload)))
        image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
        if image.mode not in {'RGB', 'RGBA'}:
            image = image.convert('RGBA' if 'transparency' in image.info else 'RGB')
        filename = f'{secrets.token_hex(16)}.webp'
        image.save(UPLOAD_DIR / filename, 'WEBP', quality=84, method=6)
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail='图片文件已损坏或格式不受支持')
    return {'url': f'/api/media/{filename}'}
