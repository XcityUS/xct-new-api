#!/bin/bash

# migrate_to_litellm.sh
# Migration script for integrating xct-new-api with xct-litellm (tokenhub.xcity.one)
#
# Usage:
#   ./bin/migrate_to_litellm.sh [--dry-run] [--backup]
#
# Options:
#   --dry-run    Show what would be changed without actually modifying the database
#   --backup     Create a backup of the channels table before migration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DRY_RUN=false
BACKUP=false
LITELLM_BASE_URL="https://tokenhub.xcity.one"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --backup)
            BACKUP=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--dry-run] [--backup]"
            echo ""
            echo "Options:"
            echo "  --dry-run    Show what would be changed without modifying the database"
            echo "  --backup     Create a backup of the channels table before migration"
            echo "  --help       Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Detect database type and connection string
if [ -n "$SQL_DSN" ]; then
    # MySQL/PostgreSQL
    if [[ "$SQL_DSN" == *"@tcp"* ]]; then
        # MySQL format: user:password@tcp(127.0.0.1:3306)/dbname
        DB_TYPE="mysql"
        echo -e "${BLUE}Detected MySQL database${NC}"
    else
        # PostgreSQL format
        DB_TYPE="postgres"
        echo -e "${BLUE}Detected PostgreSQL database${NC}"
    fi
elif [ -n "$SQLITE_PATH" ]; then
    # SQLite
    DB_TYPE="sqlite"
    echo -e "${BLUE}Detected SQLite database: $SQLITE_PATH${NC}"
else
    echo -e "${RED}Error: No database configuration found${NC}"
    echo "Please set SQL_DSN or SQLITE_PATH in your .env file"
    exit 1
fi

# Function to execute SQL for SQLite
execute_sqlite_sql() {
    local sql="$1"
    sqlite3 "$SQLITE_PATH" "$sql"
}

# Function to execute SQL for MySQL
execute_mysql_sql() {
    local sql="$1"
    # Extract connection details from SQL_DSN
    # Format: user:password@tcp(host:port)/database
    local user=$(echo "$SQL_DSN" | cut -d: -f1)
    local rest=$(echo "$SQL_DSN" | cut -d: -f2-)
    local password=$(echo "$rest" | sed 's/@.*//')
    local host_port=$(echo "$SQL_DSN" | sed 's/.*@tcp(\(.*\)).*/\1/')
    local host=$(echo "$host_port" | cut -d: -f1)
    local port=$(echo "$host_port" | cut -d: -f2)
    local database=$(echo "$SQL_DSN" | sed 's/.*\///' | cut -d? -f1)

    mysql -h "$host" -P "$port" -u "$user" -p"$password" "$database" -e "$sql"
}

# Function to execute SQL for PostgreSQL
execute_postgres_sql() {
    local sql="$1"
    psql "$SQL_DSN" -c "$sql"
}

# Generic SQL execution function
execute_sql() {
    local sql="$1"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY RUN] Would execute SQL:${NC}"
        echo "$sql"
        return 0
    fi

    case "$DB_TYPE" in
        sqlite)
            execute_sqlite_sql "$sql"
            ;;
        mysql)
            execute_mysql_sql "$sql"
            ;;
        postgres)
            execute_postgres_sql "$sql"
            ;;
    esac
}

# Backup function
backup_channels() {
    echo -e "${BLUE}Creating backup of channels table...${NC}"

    local backup_file="channels_backup_$(date +%Y%m%d_%H%M%S).sql"

    case "$DB_TYPE" in
        sqlite)
            sqlite3 "$SQLITE_PATH" ".dump channels" > "$backup_file"
            ;;
        mysql)
            mysqldump -h "$host" -P "$port" -u "$user" -p"$password" "$database" channels > "$backup_file"
            ;;
        postgres)
            pg_dump "$SQL_DSN" -t channels > "$backup_file"
            ;;
    esac

    echo -e "${GREEN}Backup created: $backup_file${NC}"
}

# Main migration function
migrate_channels() {
    echo -e "${BLUE}Starting migration to LiteLLM...${NC}"

    # Query to find OpenAI channels that need migration
    local query="SELECT id, name, base_url FROM channels WHERE type = 1"

    echo -e "${BLUE}Checking existing OpenAI channels...${NC}"

    if [ "$DB_TYPE" = "sqlite" ]; then
        local channels=$(sqlite3 "$SQLITE_PATH" "$query")
    elif [ "$DB_TYPE" = "mysql" ]; then
        local channels=$(execute_mysql_sql "$query")
    else
        local channels=$(execute_postgres_sql "$query")
    fi

    if [ -z "$channels" ]; then
        echo -e "${YELLOW}No OpenAI channels found to migrate${NC}"
        return 0
    fi

    echo -e "${GREEN}Found channels to migrate:${NC}"
    echo "$channels"

    # Update channels to use LiteLLM
    local update_sql="
        UPDATE channels
        SET base_url = '$LITELLM_BASE_URL'
        WHERE type = 1
        AND (base_url = '' OR base_url IS NULL OR base_url = 'https://api.openai.com' OR base_url = 'https://api.openai.com/v1');
    "

    echo -e "${BLUE}Updating channels to use LiteLLM base URL...${NC}"
    execute_sql "$update_sql"

    if [ "$DRY_RUN" = false ]; then
        echo -e "${GREEN}Migration completed successfully!${NC}"

        # Show updated channels
        echo -e "${BLUE}Updated channels:${NC}"
        local verify_query="SELECT id, name, base_url FROM channels WHERE type = 1"

        if [ "$DB_TYPE" = "sqlite" ]; then
            sqlite3 "$SQLITE_PATH" "$verify_query"
        elif [ "$DB_TYPE" = "mysql" ]; then
            execute_mysql_sql "$verify_query"
        else
            execute_postgres_sql "$verify_query"
        fi
    fi
}

# Main execution
echo -e "${GREEN}=== xct-new-api LiteLLM Migration Tool ===${NC}"
echo ""

if [ "$BACKUP" = true ]; then
    backup_channels
    echo ""
fi

migrate_channels

echo ""
echo -e "${GREEN}=== Migration Summary ===${NC}"
echo "Base URL: $LITELLM_BASE_URL"
echo "Database Type: $DB_TYPE"
echo "Dry Run: $DRY_RUN"
echo ""

if [ "$DRY_RUN" = false ]; then
    echo -e "${GREEN}Next steps:${NC}"
    echo "1. Update channel API keys to LiteLLM virtual keys"
    echo "2. Test the integration with a sample request"
    echo "3. Monitor logs to ensure requests are routed correctly"
    echo "4. Review the integration guide: docs/LITELLM_INTEGRATION.md"
else
    echo -e "${YELLOW}This was a dry run. No changes were made.${NC}"
    echo "Run without --dry-run to apply the changes."
fi
