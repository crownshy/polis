#!/bin/bash
set -e
set -x

cd /opt/polis
sudo yum install -y git
GIT_REPO_URL="https://github.com/compdemocracy/polis.git"
GIT_BRANCH="stable"

if [ ! -d "polis" ]; then
  echo "Cloning public repository from $GIT_REPO_URL, branch: $GIT_BRANCH (HTTPS - Public Repo)"
  git clone -b "$GIT_BRANCH" "$GIT_REPO_URL" polis
else
  echo "Polis directory already exists, skipping cloning, pulling instead"
fi

cd polis
sudo git config --global --add safe.directory /opt/polis/polis
sudo git config pull.rebase true
sudo git reset --hard origin/$GIT_BRANCH && sudo git pull

# --- Fetch pre-configured .env from SSM Parameter Store ---
PRE_CONFIGURED_ENV=$(aws secretsmanager get-secret-value --secret-id polis-web-app-env-vars --query SecretString --output text --region us-east-1)


if [ -z "$PRE_CONFIGURED_ENV" ]; then
  echo "Error: Could not retrieve pre-configured .env from SSM Parameter polis-web-app-env-vars"
  exit 1
fi

echo "Retrieved pre-configured .env from SSM Parameter"

# --- Create/Overwrite .env file with pre-configured content ---
echo "Creating/Overwriting .env file with pre-configured content from SSM"
echo "$PRE_CONFIGURED_ENV" > .env
echo ".env file created/overwritten with pre-configured content."

# --- Database Configuration and Environment Variables from Secrets Manager ---
# 1. Get Secret ARN from SSM Parameter
SECRET_ARN=$(aws ssm get-parameter --name /polis/db-secret-arn --query 'Parameter.Value' --output text --region us-east-1)

if [ -z "$SECRET_ARN" ]; then
  echo "Error: Could not retrieve DB Secret ARN from SSM Parameter /polis/db-secret-arn"
  exit 1
fi

echo "Retrieved Secret ARN from SSM Parameter: $SECRET_ARN"

# 2. Retrieve Secret Value from Secrets Manager
SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query 'SecretString' --output text --region us-east-1)

if [ -z "$SECRET_JSON" ]; then
  echo "Error: Could not retrieve DB Secret from Secrets Manager using ARN: $SECRET_ARN"
  exit 1
fi

# 3. Parse secrets JSON using jq to get dbname, username, password
DB_USERNAME=$(echo "$SECRET_JSON" | jq -r '.username')
DB_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.password')
DB_NAME=$(echo "$SECRET_JSON" | jq -r '.dbname')

# 4. Get DB Host and Port from SSM Parameters
DB_HOST=$(aws ssm get-parameter --name "/polis/db-host" --query 'Parameter.Value' --output text --region us-east-1)
DB_PORT=$(aws ssm get-parameter --name "/polis/db-port" --query 'Parameter.Value' --output text --region us-east-1)


# --- Construct DATABASE_URL using values from Secrets Manager AND SSM Parameters ---
DATABASE_URL="postgres://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo "Constructed DATABASE_URL: $DATABASE_URL"

# --- Append DATABASE_URL to the end of .env ---
echo "Appending DATABASE_URL to .env"
echo "DATABASE_URL=$DATABASE_URL" >> .env

echo "--- Final .env file content (Appended DATABASE_URL) ---"
cat .env

SERVICE_FROM_FILE=$(cat /tmp/service_type.txt)
echo "DEBUG: Service type read from /tmp/service_type.txt: [$SERVICE_FROM_FILE]"

echo "Stopping and removing existing Docker containers..."
/usr/local/bin/docker-compose down || true  # Stop all services, ignore errors if none running
docker rm -f $(docker ps -aq) || true      # Forcefully remove all containers, ignore errors
echo "Docker containers stopped and removed."

yes | docker system prune -a --filter "until=72h"
echo "Docker cache cleared"

/usr/local/bin/docker-compose config

if [ "$SERVICE_FROM_FILE" == "server" ]; then
  echo "Starting docker-compose up for 'server' and 'nginx-proxy' services"
  /usr/local/bin/docker-compose up -d server nginx-proxy --build --force-recreate
elif [ "$SERVICE_FROM_FILE" == "math" ]; then
  echo "Starting docker-compose up for 'math' service"
  /usr/local/bin/docker-compose up -d math --build --force-recreate
else
  echo "Error: Unknown service type: [$SERVICE_FROM_FILE]. Starting all services (default docker-compose up -d)"
  /usr/local/bin/docker-compose up -d --build --force-recreate # Fallback
fi