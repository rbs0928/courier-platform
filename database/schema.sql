-- ==============================================================================
-- 全運具跨城／跨國順路捎帶快遞媒合平台 - PostgreSQL + PostGIS 資料庫綱要
-- ==============================================================================

-- 啟用 PostGIS 空間地理擴充套件
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 用戶與旅人認證表
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(150),
    avatar_url TEXT,
    is_kyc_verified BOOLEAN DEFAULT FALSE, -- 身分證/護照實名認證
    kyc_document_type VARCHAR(20),        -- 'NATIONAL_ID' | 'PASSPORT'
    rating NUMERIC(3, 2) DEFAULT 5.00,
    wallet_balance NUMERIC(12, 2) DEFAULT 0.00,
    locked_escrow NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 大眾運輸樞紐與國道服務區字典表 (Hubs)
CREATE TABLE station_hubs (
    code VARCHAR(32) PRIMARY KEY,
    type VARCHAR(32) NOT NULL, -- 'MRT_STATION' | 'HSR_STATION' | 'AIRPORT' | 'HIGHWAY_HUB'
    name VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    country VARCHAR(10) DEFAULT 'TW',
    location GEOMETRY(Point, 4326) NOT NULL -- WGS84 經緯度座標
);

CREATE INDEX idx_station_hubs_location ON station_hubs USING GIST (location);

-- 3. 旅人／車主預定行程表 (Itineraries)
CREATE TABLE itineraries (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('ITIN_' || uuid_generate_v4()),
    traveler_id VARCHAR(64) NOT NULL REFERENCES users(id),
    transport_mode VARCHAR(20) NOT NULL, -- 'MOTORCYCLE' | 'MRT' | 'CAR' | 'HSR' | 'FLIGHT'
    trip_number VARCHAR(100),            -- 如 高鐵 115 次、長榮 BR192、國道一號自駕
    origin_name VARCHAR(150) NOT NULL,
    origin_point GEOMETRY(Point, 4326) NOT NULL,
    origin_hub_code VARCHAR(32) REFERENCES station_hubs(code),
    destination_name VARCHAR(150) NOT NULL,
    destination_point GEOMETRY(Point, 4326) NOT NULL,
    destination_hub_code VARCHAR(32) REFERENCES station_hubs(code),
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
    max_weight_kg NUMERIC(6, 2) NOT NULL,
    remaining_weight_kg NUMERIC(6, 2) NOT NULL,
    max_volume_cm3 INT NOT NULL,
    remaining_volume_cm3 INT NOT NULL,
    luggage_type VARCHAR(32) NOT NULL, -- 'SCOOTER_CARRIER' | 'BACKPACK' | 'CAR_TRUNK' | 'CHECKED_28INCH'
    max_detour_km NUMERIC(4, 1) DEFAULT 3.0, -- 容許面交繞路半徑
    status VARCHAR(20) DEFAULT 'PLANNED',     -- 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- GIST 空間索引：加速起點與終點範圍比對
CREATE INDEX idx_itineraries_origin_point ON itineraries USING GIST (origin_point);
CREATE INDEX idx_itineraries_destination_point ON itineraries USING GIST (destination_point);
CREATE INDEX idx_itineraries_time ON itineraries (departure_time, arrival_time);

-- 4. 包裹託運需求表 (Shipments)
CREATE TABLE shipments (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('PKG_' || uuid_generate_v4()),
    sender_id VARCHAR(64) NOT NULL REFERENCES users(id),
    recipient_name VARCHAR(100) NOT NULL,
    recipient_phone VARCHAR(30) NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(32) NOT NULL, -- 'DOCUMENT' | 'ELECTRONICS' | 'FOOD_PACKAGED' | 'OTHER'
    weight_kg NUMERIC(6, 2) NOT NULL,
    declared_value NUMERIC(10, 2) NOT NULL,
    pickup_name VARCHAR(150) NOT NULL,
    pickup_point GEOMETRY(Point, 4326) NOT NULL,
    pickup_hub_code VARCHAR(32) REFERENCES station_hubs(code),
    dropoff_name VARCHAR(150) NOT NULL,
    dropoff_point GEOMETRY(Point, 4326) NOT NULL,
    dropoff_hub_code VARCHAR(32) REFERENCES station_hubs(code),
    earliest_pickup_time TIMESTAMP WITH TIME ZONE NOT NULL,
    delivery_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    transport_mode_preference VARCHAR(20),
    status VARCHAR(30) DEFAULT 'MATCHING', -- 'MATCHING' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED'
    pickup_otp VARCHAR(10) NOT NULL,
    dropoff_otp VARCHAR(10) NOT NULL,
    assigned_traveler_id VARCHAR(64) REFERENCES users(id),
    assigned_itinerary_id VARCHAR(64) REFERENCES itineraries(id),
    pricing_quote JSONB NOT NULL,
    inspection_record JSONB,
    delivery_record JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shipments_pickup_point ON shipments USING GIST (pickup_point);
CREATE INDEX idx_shipments_dropoff_point ON shipments USING GIST (dropoff_point);
CREATE INDEX idx_shipments_status ON shipments (status);

-- 5. 平台第三方資金託管帳本 (Escrow Transactions)
CREATE TABLE escrow_transactions (
    id VARCHAR(64) PRIMARY KEY,
    shipment_id VARCHAR(64) NOT NULL REFERENCES shipments(id),
    sender_id VARCHAR(64) NOT NULL REFERENCES users(id),
    traveler_id VARCHAR(64) NOT NULL REFERENCES users(id),
    total_amount NUMERIC(10, 2) NOT NULL,
    traveler_earnings NUMERIC(10, 2) NOT NULL,
    platform_commission NUMERIC(10, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'HELD_IN_ESCROW', -- 'HELD_IN_ESCROW' | 'RELEASED_TO_TRAVELER' | 'REFUNDED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP WITH TIME ZONE
);

-- ==============================================================================
-- 6. PostGIS 原生時空走廊比對存儲函數 (Spatio-Temporal Corridor Match Function)
-- ==============================================================================
CREATE OR REPLACE FUNCTION fn_match_corridor(
    p_shipment_id VARCHAR(64)
)
RETURNS TABLE (
    itinerary_id VARCHAR(64),
    traveler_id VARCHAR(64),
    traveler_name VARCHAR(100),
    transport_mode VARCHAR(20),
    pickup_detour_km NUMERIC,
    dropoff_detour_km NUMERIC,
    total_detour_km NUMERIC,
    time_margin_minutes INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id AS itinerary_id,
        u.id AS traveler_id,
        u.name AS traveler_name,
        i.transport_mode,
        ROUND((ST_Distance(i.origin_point::geography, s.pickup_point::geography) / 1000.0)::numeric, 2) AS pickup_detour_km,
        ROUND((ST_Distance(i.destination_point::geography, s.dropoff_point::geography) / 1000.0)::numeric, 2) AS dropoff_detour_km,
        ROUND(((ST_Distance(i.origin_point::geography, s.pickup_point::geography) + 
                ST_Distance(i.destination_point::geography, s.dropoff_point::geography)) / 1000.0)::numeric, 2) AS total_detour_km,
        EXTRACT(EPOCH FROM (s.delivery_deadline - i.arrival_time))::int / 60 AS time_margin_minutes
    FROM shipments s
    JOIN itineraries i ON (
        -- 空間檢核：起點與終點皆在旅客願意繞路半徑內
        ST_DWithin(i.origin_point::geography, s.pickup_point::geography, i.max_detour_km * 1000)
        AND ST_DWithin(i.destination_point::geography, s.dropoff_point::geography, i.max_detour_km * 1000)
    )
    JOIN users u ON u.id = i.traveler_id
    WHERE s.id = p_shipment_id
      AND i.status = 'PLANNED'
      -- 載重檢核
      AND s.weight_kg <= i.remaining_weight_kg
      -- 時間窗檢核：出發前有緩衝，且抵達時間早於包裹截止時間
      AND i.departure_time >= (s.earliest_pickup_time + INTERVAL '15 minutes')
      AND i.arrival_time <= s.delivery_deadline
    ORDER BY total_detour_km ASC;
END;
$$ LANGUAGE plpgsql;
