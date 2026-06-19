#!/bin/bash

# Start MinIO for local S3-compatible storage

CONTAINER_NAME="tldraw-minio"
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ROOT_USER="minioadmin"
MINIO_ROOT_PASSWORD="minioadmin"
BUCKET_NAME="tldraw-assets"

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "MinIO container is already running"
    else
        echo "Starting existing MinIO container..."
        docker start "$CONTAINER_NAME"
    fi
else
    echo "Creating and starting MinIO container..."
    docker run -d \
        --name "$CONTAINER_NAME" \
        -p ${MINIO_PORT}:9000 \
        -p ${MINIO_CONSOLE_PORT}:9001 \
        -e "MINIO_ROOT_USER=${MINIO_ROOT_USER}" \
        -e "MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}" \
        minio/minio server /data --console-address ":9001"
fi

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
for i in {1..30}; do
    if curl -s "http://localhost:${MINIO_PORT}/minio/health/live" > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Create bucket using MinIO client (mc) via docker
echo "Creating bucket '${BUCKET_NAME}'..."
docker exec "$CONTAINER_NAME" mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" 2>/dev/null || true
docker exec "$CONTAINER_NAME" mc mb "local/${BUCKET_NAME}" 2>/dev/null || true

echo ""
echo "MinIO is running!"
echo "  Console: http://localhost:${MINIO_CONSOLE_PORT} (${MINIO_ROOT_USER}/${MINIO_ROOT_PASSWORD})"
echo ""
echo "Run these commands to configure S3 environment variables:"
echo ""
echo "  export S3_ACCESS_KEY=${MINIO_ROOT_USER}"
echo "  export S3_SECRET_KEY=${MINIO_ROOT_PASSWORD}"
echo "  export S3_BUCKET=${BUCKET_NAME}"
echo "  export S3_ENDPOINT=http://localhost:${MINIO_PORT}"
echo ""
