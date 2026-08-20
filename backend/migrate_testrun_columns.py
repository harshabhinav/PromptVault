import sys
import logging
from sqlmodel import text
from app.database.connection import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Migrator")

def migrate():
    columns_to_add = [
        ("test_case_name", "VARCHAR"),
        ("version_label", "VARCHAR"),
        ("input_text", "VARCHAR"),
        ("prompt_text", "VARCHAR"),
        ("status", "VARCHAR DEFAULT 'completed'"),
        ("error", "VARCHAR")
    ]
    
    with engine.connect() as conn:
        # Check database type
        db_type = conn.dialect.name
        logger.info(f"Database dialect: {db_type}")
        
        for col_name, col_type in columns_to_add:
            try:
                if db_type == "postgresql":
                    query = f"ALTER TABLE testrun ADD COLUMN IF NOT EXISTS {col_name} {col_type};"
                    conn.execute(text(query))
                    logger.info(f"PostgreSQL: Column '{col_name}' added or already exists.")
                else:
                    # SQLite fallback
                    query = f"ALTER TABLE testrun ADD COLUMN {col_name} {col_type};"
                    conn.execute(text(query))
                    logger.info(f"SQLite: Column '{col_name}' added.")
            except Exception as e:
                # If column already exists in SQLite or other errors, ignore
                logger.info(f"Column '{col_name}' could not be added (it may already exist): {e}")
        
        # Commit transaction
        conn.commit()
        logger.info("Migration completed successfully!")

if __name__ == "__main__":
    migrate()
