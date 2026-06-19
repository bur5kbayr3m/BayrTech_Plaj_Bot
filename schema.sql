CREATE TABLE IF NOT EXISTS trips (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tarih VARCHAR(50) NOT NULL,
  saat VARCHAR(20) NOT NULL,
  kalkis_yeri VARCHAR(100) NOT NULL,
  kapasite INTEGER DEFAULT 20,
  dolu_koltuk INTEGER DEFAULT 0,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Yeni Tablo: settings (Fiyatlar ve Mesajlar için)
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,
  value TEXT NOT NULL
);

-- Yeni Tablo: faqs (Sıkça Sorulan Sorular)
CREATE TABLE IF NOT EXISTS faqs (
  id SERIAL PRIMARY KEY,
  question VARCHAR(200) NOT NULL,
  answer TEXT NOT NULL,
  aktif BOOLEAN DEFAULT true
);

-- Tablo: reservations (Rezervasyonlar)
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tel_no TEXT NOT NULL,
  ad_soyad TEXT,
  lokasyon_adi TEXT,
  sefer_id UUID REFERENCES trips(id),
  kisi_sayisi TEXT NOT NULL,
  durum TEXT DEFAULT 'Beklemede',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
