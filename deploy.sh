#!/bin/bash

# Browsy Deployment Script
set -e

echo "🚀 Deploying Browsy..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Build and start services
echo "📦 Building Docker images..."
docker-compose -f docker/docker-compose.yml build

echo "🔄 Starting services..."
docker-compose -f docker/docker-compose.yml up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Health check
echo "🏥 Checking service health..."
if curl -f http://localhost:3100/ > /dev/null 2>&1; then
    echo "✅ Browsy server is running at http://localhost:3100"
else
    echo "❌ Browsy server health check failed"
    docker-compose -f docker/docker-compose.yml logs browsy-server
    exit 1
fi

echo "🎉 Deployment complete!"
echo ""
echo "📋 Service URLs:"
echo "   Main API: http://localhost:3100"
echo "   MCP Server: localhost:3325 (stdio)"
echo ""
echo "🔧 Management commands:"
echo "   View logs: docker-compose -f docker/docker-compose.yml logs -f"
echo "   Stop services: docker-compose -f docker/docker-compose.yml down"
echo "   Restart: docker-compose -f docker/docker-compose.yml restart"
