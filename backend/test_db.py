from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

url = URL.create(
    drivername="postgresql+psycopg",
    username="postgres",
    password="1792",
    host="localhost",
    port=5433,
    database="shiftplanner_test",
)

engine = create_engine(url)

with engine.connect() as conn:
    result = conn.execute(text("SELECT COUNT(*) FROM employees"))
    print("Employees:", result.scalar())