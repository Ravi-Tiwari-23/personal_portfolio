"""Read-only comparison with the pre-skills SQLite backup; prints no private data."""
import sqlite3
import sys

before = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
after = sqlite3.connect("file:instance/portfolio.sqlite3?mode=ro", uri=True)
tables = [row[0] for row in before.execute("SELECT name FROM sqlite_master WHERE type='table'")]
for table in tables:
    quoted = '"' + table.replace('"', '""') + '"'
    old_rows = before.execute(f"SELECT * FROM {quoted}").fetchall()
    new_rows = after.execute(f"SELECT * FROM {quoted}").fetchall()
    if table == "site_settings":
        new_rows = [row for row in new_rows if row[0] != "skills_v2_initialized"]
    assert sorted(map(repr, old_rows)) == sorted(map(repr, new_rows)), f"Existing data changed: {table}"
    print(f"Preserved: {table} ({len(old_rows)} records)")
assert after.execute("SELECT COUNT(*) FROM skills").fetchone()[0] == 10
print("Verified: all original records preserved; ten new skills added.")
before.close()
after.close()
