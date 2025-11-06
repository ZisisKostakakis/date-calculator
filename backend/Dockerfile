FROM python:3.13-slim
WORKDIR /code

# Install Python deps
COPY requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir -r /code/requirements.txt

# Copy backend source
COPY backend /code/backend

ENV DATA_DIR=/code/data
EXPOSE 5000
CMD ["python", "backend/app.py"]


