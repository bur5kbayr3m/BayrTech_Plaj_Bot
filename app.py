import os

from flask import Flask
from routes.webhook import webhook_bp

def create_app():
    app = Flask(__name__)
    
    # Rotaları (Blueprints) kaydetme
    app.register_blueprint(webhook_bp)

    @app.route('/', methods=['GET'])
    def index():
        return "GogaBeach WhatsApp Bot is running!"

    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
