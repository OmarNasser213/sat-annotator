#!/bin/sh
# wait-for-backend.sh

set -e

host="backend"
port="8000"
timeout=60
waited=0

echo "Waiting for backend ($host:$port) to be ready..."

# Wait for the backend to be ready
while [ $waited -lt $timeout ]; do
    if nc -z $host $port; then
        echo "Backend is ready!"
        break
    fi
    waited=$((waited+1))
    echo "Waiting for backend... ($waited/$timeout)"
    sleep 1
done

if [ $waited -ge $timeout ]; then
    echo "Timeout waiting for backend to be ready. Starting anyway..."
fi

# Start the frontend application
exec "$@"
