import sqlite3

def add_columns():
    conn = sqlite3.connect("promptvault.db")
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE comparison ADD COLUMN comparison_type VARCHAR DEFAULT 'version'")
        print("Added comparison_type")
    except Exception as e:
        print(f"Error adding comparison_type: {e}")

    try:
        cursor.execute("ALTER TABLE comparison ADD COLUMN branch_a VARCHAR")
        print("Added branch_a")
    except Exception as e:
        print(f"Error adding branch_a: {e}")

    try:
        cursor.execute("ALTER TABLE comparison ADD COLUMN branch_b VARCHAR")
        print("Added branch_b")
    except Exception as e:
        print(f"Error adding branch_b: {e}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    add_columns()
