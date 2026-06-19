import requests
from datetime import datetime, timedelta
from config.supabase_client import supabase
from config.settings import Config
from services.db_service import get_available_trips, create_reservation

USER_STATES = {}

def handle_incoming_message(data):
    try:
        entry = data.get('entry', [])[0]
        changes = entry.get('changes', [])[0]
        value = changes.get('value', {})
        messages = value.get('messages', [])
        
        if not messages:
            return

        message = messages[0]
        sender_phone = message.get('from')
        message_type = message.get('type')
        phone_number_id = value.get('metadata', {}).get('phone_number_id', 'YOUR_PHONE_NUMBER_ID')

        if message_type == 'text':
            USER_STATES[sender_phone] = {"step": "GUN_SECIMI"}
            send_date_selection_list(phone_number_id, sender_phone)
            
        elif message_type == 'interactive':
            interactive_type = message.get('interactive', {}).get('type')
            
            if interactive_type == 'list_reply':
                payload = message['interactive']['list_reply'].get('id')
                
                if payload.startswith('DAY_'):
                    selected_date = payload.split('_')[1]
                    USER_STATES[sender_phone] = {
                        "step": "YON_SECIMI",
                        "date": selected_date
                    }
                    send_route_selection_buttons(phone_number_id, sender_phone)
                    
                elif payload.startswith('TRIP_'):
                    trip_id = payload.split('_')[1]
                    if sender_phone in USER_STATES:
                        USER_STATES[sender_phone]["trip_id"] = trip_id
                        USER_STATES[sender_phone]["step"] = "KISI_SAYISI"
                        send_passenger_count_list(phone_number_id, sender_phone)
                        
                elif payload.startswith('PASSENGER_'):
                    passenger_count = payload.split('_')[1]
                    handle_reservation_completion(phone_number_id, sender_phone, passenger_count)
                    
            elif interactive_type == 'button_reply':
                payload = message['interactive']['button_reply'].get('id')
                
                if payload in ['ROUTE_GIDIS', 'ROUTE_DONUS']:
                    if sender_phone in USER_STATES:
                        USER_STATES[sender_phone]["route"] = payload
                        USER_STATES[sender_phone]["step"] = "SEFER_SECIMI"
                        
                        date = USER_STATES[sender_phone]["date"]
                        trips = get_available_trips(date, payload)
                        
                        if not trips:
                            send_text_message(phone_number_id, sender_phone, "Üzgünüz, bu tarihte/yönde boş yerimiz kalmamıştır.")
                            USER_STATES.pop(sender_phone, None)
                        else:
                            send_trip_selection_list(phone_number_id, sender_phone, trips)
                            
                elif payload.startswith('PASSENGER_'):
                    passenger_count = payload.split('_')[1]
                    handle_reservation_completion(phone_number_id, sender_phone, passenger_count)

    except Exception as e:
        print(f"Mesaj işlenirken hata oluştu: {e}")

def handle_reservation_completion(phone_number_id, sender_phone, passenger_count):
    if sender_phone in USER_STATES and "trip_id" in USER_STATES[sender_phone]:
        trip_id = USER_STATES[sender_phone]["trip_id"]
        
        result = create_reservation(sender_phone, trip_id, passenger_count)
        
        if result:
            send_text_message(
                phone_number_id, 
                sender_phone, 
                "🎉 Rezervasyon talebiniz başarıyla alındı! Operasyon ekibimiz kontrol ettikten sonra size onay mesajı iletecektir. Bizi tercih ettiğiniz için teşekkürler!"
            )
        else:
            send_text_message(phone_number_id, sender_phone, "⚠️ Rezervasyon işleminiz sırasında bir hata oluştu. Lütfen tekrar deneyin.")
            
        USER_STATES.pop(sender_phone, None)

def send_date_selection_list(phone_number_id, recipient_phone):
    rows = []
    today = datetime.now()
    
    for i in range(4):
        target_date = today + timedelta(days=i)
        date_str = target_date.strftime("%Y-%m-%d")
        display_str = target_date.strftime("%d.%m.%Y")
        
        rows.append({
            "id": f"DAY_{date_str}",
            "title": display_str,
            "description": "Bu tarihte seyahat et"
        })

    message_payload = {
        "messaging_product": "whatsapp",
        "to": recipient_phone,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "header": {"type": "text", "text": "📅 Seyahat Tarihi"},
            "body": {"text": "🏖️ GogaBeach Servisine Hoş Geldiniz! Lütfen seyahat gününüzü seçin."},
            "footer": {"text": "GogaBeach Rezervasyon"},
            "action": {
                "button": "Günleri Gör",
                "sections": [{"title": "Tarih Seçimi", "rows": rows}]
            }
        }
    }
    send_meta_request(phone_number_id, message_payload)

def send_route_selection_buttons(phone_number_id, recipient_phone):
    message_payload = {
        "messaging_product": "whatsapp",
        "to": recipient_phone,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": "Lütfen seyahat yönünüzü seçin:"},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": "ROUTE_GIDIS", "title": "🏖️ Merkez -> Plaj"}},
                    {"type": "reply", "reply": {"id": "ROUTE_DONUS", "title": "🏙️ Plaj -> Merkez"}}
                ]
            }
        }
    }
    send_meta_request(phone_number_id, message_payload)

def send_trip_selection_list(phone_number_id, recipient_phone, trips):
    rows = []
    for trip in trips:
        trip_id = trip.get('id')
        saat = trip.get('saat', '')
        kalkis = trip.get('kalkis_yeri', '')
        
        if saat and len(saat) >= 5:
            saat = saat[:5]
            
        rows.append({
            "id": f"TRIP_{trip_id}",
            "title": f"{saat} - {kalkis}"[:24],
            "description": "Bu seferi seç"
        })

    message_payload = {
        "messaging_product": "whatsapp",
        "to": recipient_phone,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "header": {"type": "text", "text": "🚌 Uygun Seferler"},
            "body": {"text": "Lütfen size uygun seferi seçin:"},
            "footer": {"text": "GogaBeach Rezervasyon"},
            "action": {
                "button": "Seferleri Gör",
                "sections": [{"title": "Sefer Listesi", "rows": rows[:10]}]
            }
        }
    }
    send_meta_request(phone_number_id, message_payload)

def send_passenger_count_list(phone_number_id, recipient_phone):
    rows = [
        {"id": "PASSENGER_1", "title": "1 Kişi", "description": ""},
        {"id": "PASSENGER_2", "title": "2 Kişi", "description": ""},
        {"id": "PASSENGER_3", "title": "3 Kişi", "description": ""},
        {"id": "PASSENGER_4", "title": "4 Kişi", "description": ""}
    ]

    message_payload = {
        "messaging_product": "whatsapp",
        "to": recipient_phone,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {"text": "Kaç kişilik rezervasyon yapmak istiyorsunuz?"},
            "action": {
                "button": "Kişi Sayısı",
                "sections": [{"title": "Kişi Sayısı Seçin", "rows": rows}]
            }
        }
    }
    send_meta_request(phone_number_id, message_payload)

def send_text_message(phone_number_id, recipient_phone, text):
    message_payload = {
        "messaging_product": "whatsapp",
        "to": recipient_phone,
        "type": "text",
        "text": {"body": text}
    }
    send_meta_request(phone_number_id, message_payload)

def send_meta_request(phone_number_id, message_payload):
    if not Config.META_ACCESS_TOKEN:
        print("Uyarı: META_ACCESS_TOKEN bulunamadı.")
        return
        
    url = f"https://graph.facebook.com/v17.0/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {Config.META_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, headers=headers, json=message_payload)
        if response.status_code != 200:
            print(f"Meta API Hatası: {response.status_code} - {response.text}")
        return response
    except Exception as e:
        print(f"Meta API İstek Hatası: {e}")
        return None
