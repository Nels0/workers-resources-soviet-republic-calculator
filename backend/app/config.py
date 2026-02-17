import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATABASE_PATH = os.path.join(BASE_DIR, "data", "wrsr.db")
SQLALCHEMY_DATABASE_URI = f"sqlite:///{DATABASE_PATH}"
DEBUG = os.environ.get("FLASK_DEBUG", "1") == "1"
