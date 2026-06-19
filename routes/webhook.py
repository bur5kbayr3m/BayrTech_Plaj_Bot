from flask import Blueprint, request, jsonify
from config.settings import Config
from services.whatsapp_service import handle_incoming_message

webhook_bp = Blueprint('webhook', __name__)

@webhook_bp.route('/webhook', methods=['GET', 'POST'])
def webhook():
    if request.method == 'GET':
        # Meta webhook verification
        mode = request.args.get('hub.mode')
        token = request.args.get('hub.verify_token')
        challenge = request.args.get('hub.challenge')

        if mode and token:
            if mode == 'subscribe' and token == Config.META_VERIFY_TOKEN:
                return challenge, 200
            else:
                return jsonify({"status": "error", "message": "Verification token mismatch"}), 403
        return jsonify({"status": "error", "message": "Missing parameters"}), 400

    elif request.method == 'POST':
        data = request.json
        # Gelen veriyi service katmanına yönlendir
        handle_incoming_message(data)
        
        return jsonify({"status": "success"}), 200
