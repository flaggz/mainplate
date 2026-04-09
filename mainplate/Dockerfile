FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python -c "from app import init_db; init_db()"
VOLUME ["/app/data"]
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--log-level", "warning", "--forwarded-allow-ips", "*", "app:app"]
