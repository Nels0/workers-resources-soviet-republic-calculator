from flask import Flask
from flask_cors import CORS

from .database import init_db


def create_app():
    app = Flask(__name__)
    CORS(app)

    from .routes import buildings, health, projects

    app.register_blueprint(health.bp)
    app.register_blueprint(buildings.bp)
    app.register_blueprint(projects.bp)

    init_db()

    return app
