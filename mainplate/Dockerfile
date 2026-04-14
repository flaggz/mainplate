FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download Tailwind CLI for Linux (v4.2.2 — matches local binary)
RUN python3 -c "\
import urllib.request as r, platform, os; \
arch = 'x64' if platform.machine() == 'x86_64' else 'arm64'; \
r.urlretrieve(f'https://github.com/tailwindlabs/tailwindcss/releases/download/v4.2.2/tailwindcss-linux-{arch}', '/usr/local/bin/tailwindcss'); \
os.chmod('/usr/local/bin/tailwindcss', 0o755)"

COPY . .

# Download DaisyUI v5 (Tailwind v4 plugin — only light+dark themes, purged automatically)
RUN python3 -c "\
import urllib.request as r, tarfile, shutil, os, json; \
info = json.loads(r.urlopen('https://registry.npmjs.org/daisyui/latest').read()); \
url = info['dist']['tarball']; \
print('Downloading daisyui@' + info['version']); \
r.urlretrieve(url, '/tmp/daisyui.tgz'); \
dest = '/app/node_modules/daisyui'; \
shutil.rmtree(dest, ignore_errors=True); \
os.makedirs('/app/node_modules', exist_ok=True); \
tarfile.open('/tmp/daisyui.tgz').extractall('/app/node_modules', filter='data'); \
os.rename('/app/node_modules/package', dest)"

# Rebuild CSS — Tailwind processes DaisyUI as a plugin (only used components + 2 themes)
RUN tailwindcss -i static/css/input.css -o static/css/tailwind.css --minify

RUN python -c "from app import init_db; init_db()"
VOLUME ["/app/data"]
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--log-level", "warning", "--forwarded-allow-ips", "*", "app:app"]
