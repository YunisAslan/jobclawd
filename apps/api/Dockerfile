FROM python:3.12-slim-bookworm

WORKDIR /app

# Install system dependencies for psycopg2 and playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    wget \
    gnupg \
    ca-certificates \
    # Playwright browser deps
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    libxfixes3 \
    libxext6 \
    libx11-6 \
    libxcb1 \
    libx11-xcb1 \
    libxrender1 \
    libfontconfig1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libdbus-1-3 \
    # Fonts
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-unifont \
    # LibreOffice for high-fidelity DOCX → HTML conversion
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install browser: Google Chrome on amd64, Debian chromium on arm64 (Apple Silicon).
# patchright works best with a full real browser (not chromium-headless-shell).
RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "amd64" ]; then \
        wget -qO- https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && \
        echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
        apt-get update && apt-get install -y --no-install-recommends google-chrome-stable; \
    else \
        apt-get update && apt-get install -y --no-install-recommends chromium; \
    fi \
    && rm -rf /var/lib/apt/lists/*

# Install patchright's bundled chromium-headless-shell as fallback
RUN python -m patchright install chromium

COPY apps/api/ .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
