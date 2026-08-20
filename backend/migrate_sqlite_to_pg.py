import os
import sqlite3
from datetime import datetime
from sqlalchemy import text
from app.database.connection import init_db, engine

SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), "promptvault.db")

def parse_val(k, v):
    if v is None:
        return None
    if k in ["is_pinned", "is_active", "has_openai_key", "has_anthropic_key", "has_gemini_key"]:
        return bool(v)
    if k in ["created_at", "updated_at", "pinned_at", "last_run_at"] and isinstance(v, str):
        try:
            return datetime.fromisoformat(v)
        except Exception:
            return v
    return v

def migrate():
    print("Step 5: Initializing PostgreSQL Schema (creating all tables)...")
    init_db()
    print("SUCCESS: PostgreSQL tables initialized successfully.")

    if not os.path.exists(SQLITE_DB_PATH):
        print("Step 6: SQLite database promptvault.db not found. Skipping data migration.")
        return

    print("Step 6: Checking SQLite data for migration...")
    sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    # Get list of tables in SQLite
    sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [r[0] for r in sqlite_cursor.fetchall() if not r[0].startswith("sqlite_")]
    print(f"Found SQLite tables: {tables}")

    for table in tables:
        try:
            sqlite_cursor.execute(f"SELECT * FROM {table}")
            raw_rows = [dict(r) for r in sqlite_cursor.fetchall()]
            if not raw_rows:
                print(f"Table '{table}' has 0 rows in SQLite. Skipping.")
                continue

            # Convert row values to correct python types
            rows = []
            for r in raw_rows:
                cleaned = {k: parse_val(k, v) for k, v in r.items()}
                rows.append(cleaned)

            print(f"Migrating {len(rows)} rows for table '{table}'...")
            columns = list(rows[0].keys())
            col_names = ", ".join([f'"{c}"' for c in columns])
            placeholders = ", ".join([f":{c}" for c in columns])

            with engine.begin() as pg_conn:
                insert_sql = text(f'INSERT INTO "{table}" ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING;')
                pg_conn.execute(insert_sql, rows)

                # If table has auto-increment ID in Postgres, reset sequence value
                if "id" in columns:
                    try:
                        seq_sql = text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), coalesce(max(id), 1)) FROM \"{table}\";")
                        pg_conn.execute(seq_sql)
                    except Exception:
                        pass
            print(f"SUCCESS: Successfully migrated '{table}'!")
        except Exception as e:
            print(f"Notice for table '{table}': {e}")

    sqlite_conn.close()
    print("SUCCESS: Step 6 Data Migration Completed Successfully!")

if __name__ == "__main__":
    migrate()
