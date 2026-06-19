from config.supabase_client import supabase

def get_available_trips(date, route):
    """
    Verilen tarih ve yöne göre aktif olan ve boş yer bulunan seferleri getirir.
    route parametresi: 'ROUTE_GIDIS' veya 'ROUTE_DONUS' olarak gelir.
    """
    yon = 'Gidis' if route == 'ROUTE_GIDIS' else 'Donus'
    
    try:
        # Supabase trips tablosuna sorgu
        # Not: Eger aktif kolonu tabloda yoksa Supabase hata verebilir, 
        # isteğinize istinaden .eq('aktif', True) filtresi eklendi.
        response = supabase.table('trips').select('*').eq('tarih', date).eq('yon', yon).eq('aktif', True).execute()
        trips = response.data
        
        available_trips = []
        for trip in trips:
            # Sadece rezerve_edilen < toplam_kapasite olan seferler (boş yer olanlar)
            rezerve_edilen = trip.get('rezerve_edilen', 0)
            toplam_kapasite = trip.get('toplam_kapasite', 0)
            
            # None gelme ihtimaline karsi kontrol
            if rezerve_edilen is None: rezerve_edilen = 0
            if toplam_kapasite is None: toplam_kapasite = 0
                
            if rezerve_edilen < toplam_kapasite:
                available_trips.append(trip)
                
        return available_trips
    except Exception as e:
        print(f"Veritabanı hatası (get_available_trips): {e}")
        return []

def create_reservation(phone_number, trip_id, passenger_count):
    """
    Müşterinin rezervasyon talebini 'Beklemede' statüsü ile reservations tablosuna kaydeder.
    """
    try:
        data = {
            "tel_no": phone_number,
            "sefer_id": trip_id,
            "kisi_sayisi": int(passenger_count),
            "durum": "Beklemede"
        }
        response = supabase.table('reservations').insert(data).execute()
        return response.data
    except Exception as e:
        print(f"Veritabanı hatası (create_reservation): {e}")
        return None
