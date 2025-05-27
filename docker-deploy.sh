#!/bin/bash
set -euo pipefail  # abort on errors, undefined vars, and fail on pipe errors

# Configuration
SERVER_IP="${SERVER_IP}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASSWORD="${SERVER_PASSWORD}"
SERVER_PORT="${SERVER_PORT:-22}"
LOCAL_DIR="$(pwd)"
DOCKER_USERNAME="${DOCKER_USERNAME}"

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Display script banner
echo -e "${GREEN}========================================"
echo -e "    Docker Deploy Script to DigitalOcean"
echo -e "========================================${NC}"

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed. Please install it first.${NC}"
    exit 1
fi

# Verify local Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running. Please start Docker and retry.${NC}"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}Installing sshpass for password automation...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install sshpass
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y sshpass
    else
        echo -e "${RED}Please install sshpass manually for your operating system.${NC}"
        exit 1
    fi
fi

# Confirm deployment
echo -e "${YELLOW}This will build and deploy Docker containers to:${NC} $SERVER_IP"
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Deployment canceled.${NC}"
    exit 1
fi

# Ask about database reset
echo
echo -e "${YELLOW}Would you like to reset the database?${NC}"
echo -e "This will delete the existing database volume and start fresh."
read -p "Reset database? (y/n): " -n 1 -r DB_RESET
echo

# Navigate to the project directory
cd "$LOCAL_DIR" || { echo -e "${RED}Error: Could not navigate to $LOCAL_DIR${NC}"; exit 1; }

# Enable Docker BuildKit for multi-platform builds
export DOCKER_BUILDKIT=1

# Check if buildx is available
if ! docker buildx version &> /dev/null; then
    echo -e "${YELLOW}Setting up Docker BuildX...${NC}"
    docker buildx create --name multiarch --use || true
    docker buildx inspect --bootstrap
fi

# Build and push images directly with BuildX for multiple platforms
echo -e "${BLUE}Building and pushing multi-platform images...${NC}"

# Build site-frontend
echo "Building site-frontend..."
docker buildx build --platform linux/amd64,linux/arm64 \
  -t $DOCKER_USERNAME/leadapp_site:latest \
  -f ./Site/Dockerfile ./Site \
  --push

# Build database-site
echo "Building database-site..."
docker buildx build --platform linux/amd64,linux/arm64 \
  -t $DOCKER_USERNAME/leadapp_database_site:latest \
  -f ./DatabaseSite/Dockerfile ./DatabaseSite \
  --push

# Build intermediary
echo "Building intermediary..."
docker buildx build --platform linux/amd64,linux/arm64 \
  -t $DOCKER_USERNAME/leadapp_intermediary:latest \
  -f ./Logic/Intermediary/Dockerfile ./Logic/Intermediary \
  --push

# Build scheduler
echo "Building scheduler..."
docker buildx build --platform linux/amd64,linux/arm64 \
  -t $DOCKER_USERNAME/leadapp_scheduler:latest \
  -f ./Logic/Scheduler/Dockerfile ./Logic/Scheduler \
  --push

# Build messenger
echo "Building messenger..."
docker buildx build --platform linux/amd64,linux/arm64 \
  -t $DOCKER_USERNAME/leadapp_messenger:latest \
  -f ./Logic/Messaging/Dockerfile ./Logic/Messaging \
  --push

# Build calendar service
echo "Building calendar service..."
docker buildx build --platform linux/amd64,linux/arm64 \
  -t $DOCKER_USERNAME/leadapp_calendar:latest \
  -f ./Logic/Calendar/Dockerfile ./Logic/Calendar \
  --push

# Build user data site
echo "Building user-data-site..."
docker buildx build --platform linux/amd64,linux/arm64 \
  -t $DOCKER_USERNAME/leadapp_userdata_site:latest \
  -f ./UserDataSite/Dockerfile ./UserDataSite \
  --push

# Extract Google Calendar environment variables from .env file
if [ -f "./Logic/Calendar/.env" ]; then
    echo -e "${BLUE}Extracting Google Calendar credentials from .env file...${NC}"
    source "./Logic/Calendar/.env"
    GOOGLE_ENV_VARS=$(grep -E "^GOOGLE_|^CALENDAR_" ./Logic/Calendar/.env)
else
    echo -e "${YELLOW}Warning: ./Logic/Calendar/.env file not found. Google Calendar integration might not work.${NC}"
    GOOGLE_ENV_VARS=""
fi

# Create a temporary docker-compose file for the server
echo -e "${BLUE}Creating deployment docker-compose.yml...${NC}"
cat > /tmp/docker-compose.deploy.yml << EOF
version: '3'

services:
  # MySQL Database
  mysql:
    image: mysql:8.0
    command: --default-authentication-plugin=mysql_native_password
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
      - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql
      - ./mysql-healthcheck.sh:/mysql-healthcheck.sh
      - ./low-memory.cnf:/etc/mysql/conf.d/low-memory.cnf
    networks:
      - lead-network
    restart: always
    healthcheck:
      test: ["CMD", "bash", "/mysql-healthcheck.sh"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  # Site - ASP.NET Core application
  site:
    image: $DOCKER_USERNAME/leadapp_site:latest
    platform: linux/amd64
    ports:
      - "5050:80"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=http://+:80
      - ConnectionStrings__DefaultConnection=server=mysql;port=3306;database=${DB_NAME};user=${DB_USER};password=${DB_PASSWORD};AllowZeroDateTime=True;ConvertZeroDateTime=True
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - lead-network
    restart: always

  # Database Site - ASP.NET Core application
  database-site:
    image: $DOCKER_USERNAME/leadapp_database_site:latest
    platform: linux/amd64
    ports:
      - "5051:80"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=http://+:80
      - ConnectionStrings__DefaultConnection=server=mysql;port=3306;database=${DB_NAME};user=${DB_USER};password=${DB_PASSWORD};AllowZeroDateTime=True;ConvertZeroDateTime=True
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - lead-network
    restart: always

  # User Data Site - ASP.NET Core application
  user-data-site:
    image: $DOCKER_USERNAME/leadapp_userdata_site:latest
    platform: linux/amd64
    ports:
      - "5052:80"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=http://+:80
      - ConnectionStrings__DefaultConnection=server=mysql;port=3306;database=${DB_NAME};user=${DB_USER};password=${DB_PASSWORD};AllowZeroDateTime=True;ConvertZeroDateTime=True
      - UserDataPassword=${USER_DATA_PASSWORD}
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - lead-network
    restart: always

  # Node.js Intermediary Server
  intermediary:
    image: $DOCKER_USERNAME/leadapp_intermediary:latest
    platform: linux/amd64
    ports:
      - "5002:5002"
    environment:
      - DB_HOST=mysql
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
      - FACEBOOK_API_URL=http://host.docker.internal:5001
    depends_on:
      - mysql
      - scheduler
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks:
      - lead-network
    restart: always

  # Scheduler - Message scheduling service
  scheduler:
    image: $DOCKER_USERNAME/leadapp_scheduler:latest
    platform: linux/amd64
    ports:
      - "3001:3001"
    environment:
      - DB_HOST=mysql
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
      - PORT=3001
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - mysql
      - messenger
    networks:
      - lead-network
    restart: always

  # Calendar service
  calendar:
    image: $DOCKER_USERNAME/leadapp_calendar:latest
    platform: linux/amd64
    ports:
      - "3002:3002"
    environment:
      - PORT=3002
      - GOOGLE_PROJECT_ID=${GOOGLE_PROJECT_ID:-sound-coil-455613-q9}
      - GOOGLE_PRIVATE_KEY_ID=${GOOGLE_PRIVATE_KEY_ID:-}
      - GOOGLE_PRIVATE_KEY=${GOOGLE_PRIVATE_KEY:-}
      - GOOGLE_CLIENT_EMAIL=${GOOGLE_CLIENT_EMAIL:-customers-booking-account@sound-coil-455613-q9.iam.gserviceaccount.com}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
      - GOOGLE_CLIENT_CERT_URL=${GOOGLE_CLIENT_CERT_URL:-}
      - CALENDAR_ID=${CALENDAR_ID:-primary}
    depends_on:
      - mysql
    networks:
      - lead-network
    restart: always

  # Messenger - Message sending service
  messenger:
    image: $DOCKER_USERNAME/leadapp_messenger:latest
    platform: linux/amd64
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=mysql
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
      - PORT=3000
      - TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
      - TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
      - TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - mysql
    networks:
      - lead-network
    restart: always

networks:
  lead-network:
    driver: bridge

volumes:
  mysql-data:
    driver: local
    driver_opts:
      o: bind
      type: none
      device: /var/lib/mysql-data
EOF

# Create MySQL healthcheck script
cat > /tmp/mysql-healthcheck.sh << 'EOF'
#!/bin/bash
# MySQL healthcheck script

# Wait for MySQL to be ready
if ! mysqladmin ping -h localhost -u root -p${MYSQL_ROOT_PASSWORD} --silent; then
  echo "MySQL is not responding"
  exit 1
fi

# Check if we can query the database
if ! mysql -h localhost -u root -p${MYSQL_ROOT_PASSWORD} -e "USE ${DB_NAME}; SELECT 1;" > /dev/null 2>&1; then
  echo "Cannot query the ${DB_NAME} database"
  exit 1
fi

echo "MySQL is healthy"
exit 0
EOF

# Create a setup script for the server
cat > /tmp/server_setup.sh << EOF
#!/bin/bash

# Update system
apt-get update
apt-get upgrade -y

# Install Docker if not already installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
    add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable"
    apt-get update
    apt-get install -y docker-ce
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose if not already installed
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.20.3/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    rm -f /usr/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    export PATH=/usr/local/bin:$PATH
fi

# Create directory for application
mkdir -p /var/www/leadapp

# Create persistent data directory for MySQL with proper permissions
mkdir -p /var/lib/mysql-data
chmod 777 /var/lib/mysql-data
EOF

# Upload and execute the setup script
echo -e "${BLUE}Setting up the server with Docker and Docker Compose...${NC}"
sshpass -p "$SERVER_PASSWORD" scp -P $SERVER_PORT -o StrictHostKeyChecking=no /tmp/server_setup.sh "$SERVER_USER@$SERVER_IP:/tmp/server_setup.sh"
sshpass -p "$SERVER_PASSWORD" ssh -p $SERVER_PORT -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "chmod +x /tmp/server_setup.sh && /tmp/server_setup.sh"

# Upload the deployment docker-compose.yml to the server
echo -e "${BLUE}Uploading deployment files to server...${NC}"
sshpass -p "$SERVER_PASSWORD" scp -P $SERVER_PORT -o StrictHostKeyChecking=no /tmp/docker-compose.deploy.yml "$SERVER_USER@$SERVER_IP:/var/www/leadapp/docker-compose.yml"
sshpass -p "$SERVER_PASSWORD" scp -P $SERVER_PORT -o StrictHostKeyChecking=no /tmp/mysql-healthcheck.sh "$SERVER_USER@$SERVER_IP:/var/www/leadapp/mysql-healthcheck.sh"

# Upload SQL initialization script
echo -e "${BLUE}Uploading database schema file...${NC}"
sshpass -p "$SERVER_PASSWORD" scp -P $SERVER_PORT -o StrictHostKeyChecking=no ./Database/schema.sql "$SERVER_USER@$SERVER_IP:/var/www/leadapp/schema.sql"

# Create a temporary deploy script to run on the server
cat > /tmp/server_deploy.sh << EOF
#!/bin/bash
export PATH=/usr/local/bin:$PATH
DB_RESET="${DB_RESET}"
export COMPOSE_HTTP_TIMEOUT=200
export DOCKER_CLIENT_TIMEOUT=200
cd /var/www/leadapp

# Ensure the healthcheck file is executable
chmod +x mysql-healthcheck.sh

# Stop any running containers with increased timeout, remove orphans & volumes
docker-compose down --remove-orphans -v -t 120 || true

# If database reset is requested, remove the volume
if [[ "$DB_RESET" =~ ^[Yy]$ ]]; then
    echo "Removing MySQL volume..."
    MYSQL_VOLUME=\$(docker volume ls --format "{{.Name}}" | grep -E "mysql-data|lead.*mysql|mysql.*lead")
    if [ -n "\$MYSQL_VOLUME" ]; then
        docker volume rm -f \$MYSQL_VOLUME || true
    fi
    echo "Cleaning data directory..."
    rm -rf /var/lib/mysql-data/*
fi

# Pull the latest images
echo "Pulling the latest Docker images..."
docker-compose pull

# Start the containers
echo "Starting the containers..."
docker-compose up -d

# Show the status
echo "Container status:"
docker-compose ps

echo "Deployment complete!"
EOF

# Upload and execute the deploy script
echo -e "${BLUE}Deploying to server...${NC}"
sshpass -p "$SERVER_PASSWORD" scp -P $SERVER_PORT -o StrictHostKeyChecking=no /tmp/server_deploy.sh "$SERVER_USER@$SERVER_IP:/tmp/server_deploy.sh"
sshpass -p "$SERVER_PASSWORD" ssh -p $SERVER_PORT -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "chmod +x /tmp/server_deploy.sh && /tmp/server_deploy.sh"

# Setup firewall to allow necessary ports
echo -e "${BLUE}Setting up firewall...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh -p $SERVER_PORT -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "
    # Enable firewall
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3306/tcp
    ufw allow 5050/tcp
    ufw allow 5051/tcp
    ufw allow 5052/tcp
    ufw allow 5001/tcp
    ufw allow 5002/tcp
    ufw allow 3000/tcp
    ufw allow 3001/tcp
    ufw allow 3002/tcp
    echo 'y' | ufw enable
"

# Cleanup temporary files
rm /tmp/docker-compose.deploy.yml
rm /tmp/server_setup.sh
rm /tmp/server_deploy.sh
rm /tmp/mysql-healthcheck.sh

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}Your application should be available at:${NC}"
echo -e "${GREEN} - Site Frontend: http://$SERVER_IP:5050${NC}"
echo -e "${GREEN} - Database Site: http://$SERVER_IP:5051${NC}"
echo -e "${GREEN} - User Data Site: http://$SERVER_IP:5052${NC}"

# Add information about monitoring and maintenance
echo -e "\n${BLUE}Monitoring Commands:${NC}"
echo -e "1. Check container status: ssh $SERVER_USER@$SERVER_IP 'cd /var/www/leadapp && docker-compose ps'"
echo -e "2. View container logs: ssh $SERVER_USER@$SERVER_IP 'cd /var/www/leadapp && docker-compose logs -f [service_name]'"
echo -e "3. Check MySQL status: ssh $SERVER_USER@$SERVER_IP 'cd /var/www/leadapp && docker-compose exec mysql mysqladmin -u root -p$MYSQL_ROOT_PASSWORD status'"
echo -e "4. Backup database: ssh $SERVER_USER@$SERVER_IP 'cd /var/www/leadapp && docker-compose exec mysql mysqldump -u root -p$MYSQL_ROOT_PASSWORD $DB_NAME > /var/www/leadapp/backup-\$(date +%Y%m%d).sql'"
