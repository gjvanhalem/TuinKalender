#!/bin/bash

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_CONTAINER_NAME="tuinkalender-db-1" # Adjust if your container name is different
DB_NAME="tuinkalender"
DB_USER="user"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "Starting backup for $TIMESTAMP..."

# 1. Backup PostgreSQL database (if running in Docker)
if [ "$(docker ps -q -f name=$DB_CONTAINER_NAME)" ]; then
    echo "Backing up PostgreSQL database..."
    docker exec $DB_CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/db_backup_$TIMESTAMP.sql
else
    echo "Warning: DB container $DB_CONTAINER_NAME not found. Skipping SQL backup."
fi

# 2. Backup SQLite database (if it exists)
if [ -f "backend/tuinkalender.db" ]; then
    echo "Backing up SQLite database..."
    cp backend/tuinkalender.db $BACKUP_DIR/sqlite_backup_$TIMESTAMP.db
fi

# 3. Backup Images
echo "Backing up plant images..."
tar -czf $BACKUP_DIR/images_backup_$TIMESTAMP.tar.gz backend/images/

echo "Backup completed successfully!"
echo "Files located in: $BACKUP_DIR"
