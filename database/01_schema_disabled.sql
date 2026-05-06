-- ============================================================
-- KPI Dashboard — MySQL Schema
-- Based on: sporthink_ornek_veri_seti_spesifikasyonu.xlsx
-- ============================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ============================================================
-- 1. USERS (Authentication & Authorization)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'marketing', 'viewer') NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- Default admin user (password: Admin2026!)
INSERT INTO users (email, password_hash, full_name, role) VALUES
('admin@sporthink.com', '$2b$10$placeholder', 'Admin User', 'admin');

-- ============================================================
-- 2. GA4 TRAFFIC (Session & Traffic Report)
-- Source: GA4 Data API v1 — runReport endpoint
-- ============================================================
CREATE TABLE IF NOT EXISTS ga4_traffic (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    date VARCHAR(8) NOT NULL COMMENT 'YYYYMMDD format from GA4',
    sessionSource VARCHAR(255) NULL,
    sessionMedium VARCHAR(255) NULL,
    sessionCampaignName VARCHAR(500) NULL,
    sessionDefaultChannelGroup VARCHAR(255) NULL,
    deviceCategory VARCHAR(50) NULL COMMENT 'mobile, desktop, tablet',
    city VARCHAR(255) NULL,
    landingPagePlusQueryString VARCHAR(2000) NULL,
    newVsReturning VARCHAR(20) NULL COMMENT 'new, returning',
    sessions INT NOT NULL DEFAULT 0,
    totalUsers INT NOT NULL DEFAULT 0,
    newUsers INT NOT NULL DEFAULT 0,
    bounceRate DECIMAL(10,6) NULL COMMENT '0-1 float',
    averageSessionDuration DECIMAL(12,2) NULL COMMENT 'seconds',
    screenPageViewsPerSession DECIMAL(10,4) NULL,
    engagedSessions INT NOT NULL DEFAULT 0,
    engagementRate DECIMAL(10,6) NULL COMMENT '0-1 float',
    userEngagementDuration DECIMAL(14,2) NULL COMMENT 'total seconds',
    conversions INT NOT NULL DEFAULT 0,
    purchaseRevenue DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'TL',
    transactions INT NOT NULL DEFAULT 0,
    import_batch_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ga4_traffic_date (date),
    INDEX idx_ga4_traffic_channel (sessionDefaultChannelGroup),
    INDEX idx_ga4_traffic_source (sessionSource, sessionMedium),
    INDEX idx_ga4_traffic_device (deviceCategory),
    INDEX idx_ga4_traffic_city (city),
    INDEX idx_ga4_traffic_campaign (sessionCampaignName(255)),
    INDEX idx_ga4_traffic_batch (import_batch_id)
) ENGINE=InnoDB;

-- ============================================================
-- 3. GA4 ITEM INTERACTIONS (Product-level E-commerce)
-- Source: GA4 Data API v1 — Item-scoped dimensions & metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS ga4_item_interactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    date VARCHAR(8) NOT NULL COMMENT 'YYYYMMDD format',
    itemId VARCHAR(100) NOT NULL COMMENT 'SKU - cross-platform join key',
    itemName VARCHAR(500) NULL,
    itemCategory VARCHAR(255) NULL COMMENT 'Level 1 category',
    itemCategory2 VARCHAR(255) NULL COMMENT 'Level 2 subcategory',
    itemBrand VARCHAR(255) NULL,
    itemsViewed INT NOT NULL DEFAULT 0,
    itemsAddedToCart INT NOT NULL DEFAULT 0,
    itemsCheckedOut INT NOT NULL DEFAULT 0,
    itemsPurchased INT NOT NULL DEFAULT 0,
    itemRevenue DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    itemListViews INT NOT NULL DEFAULT 0,
    itemListClicks INT NOT NULL DEFAULT 0,
    cartToViewRate DECIMAL(10,6) NULL COMMENT '0-1 float',
    import_batch_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ga4_items_date (date),
    INDEX idx_ga4_items_itemid (itemId),
    INDEX idx_ga4_items_category (itemCategory),
    INDEX idx_ga4_items_brand (itemBrand),
    INDEX idx_ga4_items_batch (import_batch_id)
) ENGINE=InnoDB;

-- ============================================================
-- 4. META ADS (Facebook/Instagram Ad Performance)
-- Source: Meta Marketing API — Insights API
-- Note: Meta API returns ALL metrics as STRING — converted here
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ads (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    date_start DATE NOT NULL,
    date_stop DATE NOT NULL,
    account_id VARCHAR(100) NULL,
    account_name VARCHAR(255) NULL,
    campaign_id VARCHAR(100) NULL,
    campaign_name VARCHAR(500) NULL,
    adset_id VARCHAR(100) NULL,
    adset_name VARCHAR(500) NULL,
    ad_id VARCHAR(100) NULL,
    ad_name VARCHAR(500) NULL,
    objective VARCHAR(100) NULL COMMENT 'OUTCOME_SALES, OUTCOME_TRAFFIC, etc.',
    buying_type VARCHAR(50) NULL COMMENT 'AUCTION, RESERVED',
    impressions BIGINT NOT NULL DEFAULT 0,
    reach BIGINT NOT NULL DEFAULT 0,
    frequency DECIMAL(10,4) NULL,
    clicks INT NOT NULL DEFAULT 0,
    inline_link_clicks INT NOT NULL DEFAULT 0,
    spend DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'TL',
    cpc DECIMAL(10,4) NULL,
    cpm DECIMAL(10,4) NULL,
    cpp DECIMAL(10,4) NULL,
    ctr DECIMAL(10,4) NULL COMMENT 'Percentage format (3.33 = 3.33%)',
    inline_link_click_ctr DECIMAL(10,4) NULL,
    actions_link_click INT NOT NULL DEFAULT 0,
    actions_landing_page_view INT NOT NULL DEFAULT 0,
    actions_view_content INT NOT NULL DEFAULT 0,
    actions_add_to_cart INT NOT NULL DEFAULT 0,
    actions_initiate_checkout INT NOT NULL DEFAULT 0,
    actions_purchase INT NOT NULL DEFAULT 0,
    action_values_purchase DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Purchase value TL',
    actions_page_engagement INT NOT NULL DEFAULT 0,
    actions_post_engagement INT NOT NULL DEFAULT 0,
    actions_video_view INT NOT NULL DEFAULT 0,
    import_batch_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_meta_ads_date (date_start),
    INDEX idx_meta_ads_campaign (campaign_name(255)),
    INDEX idx_meta_ads_objective (objective),
    INDEX idx_meta_ads_batch (import_batch_id)
) ENGINE=InnoDB;

-- ============================================================
-- 5. META ADS BREAKDOWNS (Demographic & Platform Breakdowns)
-- Source: Meta Insights API — breakdowns parameter
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_ads_breakdowns (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    date_start DATE NOT NULL,
    date_stop DATE NOT NULL,
    campaign_name VARCHAR(500) NULL,
    adset_name VARCHAR(500) NULL,
    ad_name VARCHAR(500) NULL,
    publisher_platform VARCHAR(100) NULL COMMENT 'facebook, instagram, audience_network, messenger',
    platform_position VARCHAR(100) NULL COMMENT 'feed, story, reels, etc.',
    impression_device VARCHAR(100) NULL COMMENT 'desktop, mobile_app, mobile_web',
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks INT NOT NULL DEFAULT 0,
    spend DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    import_batch_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_meta_break_date (date_start),
    INDEX idx_meta_break_campaign (campaign_name(255)),
    INDEX idx_meta_break_platform (publisher_platform),
    INDEX idx_meta_break_batch (import_batch_id)
) ENGINE=InnoDB;

-- ============================================================
-- 6. GOOGLE ADS (Campaign & Ad Performance)
-- Source: Google Ads API — GAQL
-- Note: cost_micros stored as BIGINT (1 TL = 1,000,000 micros)
-- ============================================================
CREATE TABLE IF NOT EXISTS google_ads (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL COMMENT 'segments.date YYYY-MM-DD',
    customer_id VARCHAR(50) NULL,
    customer_descriptive_name VARCHAR(255) NULL,
    campaign_id VARCHAR(50) NULL,
    campaign_name VARCHAR(500) NULL,
    campaign_status VARCHAR(50) NULL COMMENT 'ENABLED, PAUSED, REMOVED',
    advertising_channel_type VARCHAR(100) NULL COMMENT 'SEARCH, SHOPPING, PERFORMANCE_MAX, DISPLAY, VIDEO',
    ad_group_id VARCHAR(50) NULL,
    ad_group_name VARCHAR(500) NULL,
    ad_group_status VARCHAR(50) NULL,
    device VARCHAR(50) NULL COMMENT 'MOBILE, DESKTOP, TABLET, OTHER',
    ad_network_type VARCHAR(100) NULL COMMENT 'SEARCH, SEARCH_PARTNERS, CONTENT, etc.',
    product_item_id VARCHAR(100) NULL COMMENT 'Only for Shopping/PMax',
    product_title VARCHAR(500) NULL,
    product_brand VARCHAR(255) NULL,
    product_type_l1 VARCHAR(255) NULL,
    product_type_l2 VARCHAR(255) NULL,
    keyword_text VARCHAR(500) NULL COMMENT 'Only for Search campaigns',
    keyword_match_type VARCHAR(50) NULL COMMENT 'EXACT, PHRASE, BROAD',
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks INT NOT NULL DEFAULT 0,
    cost_micros BIGINT NOT NULL DEFAULT 0 COMMENT '1 TL = 1000000 micros',
    ctr DECIMAL(10,6) NULL COMMENT '0-1 format',
    average_cpc BIGINT NULL COMMENT 'micros',
    average_cpm BIGINT NULL COMMENT 'micros',
    conversions DECIMAL(12,4) NULL COMMENT 'Float from API',
    conversions_value DECIMAL(15,2) NULL COMMENT 'TL',
    all_conversions DECIMAL(12,4) NULL,
    all_conversions_value DECIMAL(15,2) NULL,
    cost_per_conversion BIGINT NULL COMMENT 'micros',
    conversions_from_interactions_rate DECIMAL(10,6) NULL,
    value_per_conversion DECIMAL(15,2) NULL,
    search_impression_share DECIMAL(10,6) NULL,
    search_budget_lost_impression_share DECIMAL(10,6) NULL,
    search_rank_lost_impression_share DECIMAL(10,6) NULL,
    view_through_conversions INT NOT NULL DEFAULT 0,
    interaction_rate DECIMAL(10,6) NULL,
    import_batch_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_gads_date (date),
    INDEX idx_gads_campaign (campaign_name(255)),
    INDEX idx_gads_channel (advertising_channel_type),
    INDEX idx_gads_device (device),
    INDEX idx_gads_product (product_item_id),
    INDEX idx_gads_batch (import_batch_id)
) ENGINE=InnoDB;

-- ============================================================
-- 7. ORDERS (E-Commerce Order Header)
-- Source: sporthink.com.tr e-commerce database
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(50) NOT NULL PRIMARY KEY,
    order_date DATETIME NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    city VARCHAR(255) NULL,
    device VARCHAR(50) NULL COMMENT 'mobile, desktop, tablet',
    channel VARCHAR(100) NULL COMMENT 'Matches GA4 sessionDefaultChannelGroup',
    source VARCHAR(255) NULL COMMENT 'Matches GA4 sessionSource',
    medium VARCHAR(100) NULL COMMENT 'Matches GA4 sessionMedium',
    campaign_name VARCHAR(500) NULL COMMENT 'Nullable for direct/organic',
    coupon_code VARCHAR(100) NULL,
    product_count INT NOT NULL DEFAULT 0,
    order_revenue DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'TL',
    shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    net_revenue DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'order_revenue - discount - refund',
    order_status VARCHAR(50) NOT NULL DEFAULT 'pending' COMMENT 'completed, cancelled, refunded, pending, shipped',
    payment_method VARCHAR(100) NULL COMMENT 'credit_card, debit_card, bank_transfer, pay_at_door',
    import_batch_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_orders_date (order_date),
    INDEX idx_orders_customer (customer_id),
    INDEX idx_orders_channel (channel),
    INDEX idx_orders_campaign (campaign_name(255)),
    INDEX idx_orders_device (device),
    INDEX idx_orders_city (city),
    INDEX idx_orders_status (order_status),
    INDEX idx_orders_batch (import_batch_id)
) ENGINE=InnoDB;

-- ============================================================
-- 8. ORDER ITEMS (E-Commerce Order Line Items)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    line_id INT NOT NULL,
    item_id VARCHAR(100) NOT NULL COMMENT 'SKU = itemId = product_item_id',
    item_name VARCHAR(500) NULL,
    item_category VARCHAR(255) NULL,
    item_category2 VARCHAR(255) NULL,
    item_brand VARCHAR(255) NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    line_total DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'quantity × unit_price',
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    import_batch_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_order_line (order_id, line_id),
    INDEX idx_oi_order (order_id),
    INDEX idx_oi_item (item_id),
    INDEX idx_oi_category (item_category),
    INDEX idx_oi_brand (item_brand),
    INDEX idx_oi_batch (import_batch_id),
    CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 9. PRODUCTS (Product Master Catalog)
-- Cross-platform join key: sku = itemId = item_id = product_item_id
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    sku VARCHAR(100) NOT NULL PRIMARY KEY,
    product_name VARCHAR(500) NOT NULL,
    category VARCHAR(255) NULL COMMENT 'Ayakkabı, Giyim, Aksesuar, Ekipman',
    sub_category VARCHAR(255) NULL,
    brand VARCHAR(255) NULL,
    gender VARCHAR(50) NULL COMMENT 'Erkek, Kadın, Unisex',
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Satış fiyatı TL',
    cost_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Maliyet fiyatı TL',
    stock_quantity INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATE NULL,
    color VARCHAR(100) NULL,
    size_range VARCHAR(100) NULL COMMENT 'Ayakkabı: 36-46, Giyim: S-XL',
    import_batch_id INT NULL,
    row_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_products_category (category),
    INDEX idx_products_brand (brand),
    INDEX idx_products_active (is_active),
    INDEX idx_products_batch (import_batch_id)
) ENGINE=InnoDB;

-- ============================================================
-- 10. CUSTOMERS (Customer Master for Cohort & CLV)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR(50) NOT NULL PRIMARY KEY,
    customer_name VARCHAR(255) NULL,
    first_order_date DATE NULL COMMENT 'Cohort determination',
    registration_date DATE NULL,
    city VARCHAR(255) NULL,
    gender VARCHAR(10) NULL COMMENT 'M, F',
    age_group VARCHAR(20) NULL COMMENT '18-24, 25-34, 35-44, 45-54, 55+',
    registration_source VARCHAR(100) NULL,
    is_newsletter_subscriber BOOLEAN NOT NULL DEFAULT FALSE,
    total_orders INT NOT NULL DEFAULT 0,
    total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'CLV calculation',
    last_order_date DATE NULL COMMENT 'Recency calculation',
    import_batch_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cust_city (city),
    INDEX idx_cust_age (age_group),
    INDEX idx_cust_source (registration_source),
    INDEX idx_cust_first_order (first_order_date),
    INDEX idx_cust_batch (import_batch_id)
) ENGINE=InnoDB;

-- ============================================================
-- 11. CAMPAIGNS (Campaign Master Table)
-- Join key: campaign_name links to all tables
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
    campaign_name VARCHAR(500) NOT NULL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL COMMENT 'meta, google',
    campaign_type VARCHAR(100) NULL COMMENT 'OUTCOME_SALES, SEARCH, SHOPPING, etc.',
    objective VARCHAR(100) NULL COMMENT 'Awareness, Traffic, Conversion, Retargeting',
    start_date DATE NULL,
    end_date DATE NULL,
    daily_budget DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_budget DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    target_audience VARCHAR(500) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' COMMENT 'active, paused, completed',
    import_batch_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_camp_platform (platform),
    INDEX idx_camp_status (status),
    INDEX idx_camp_dates (start_date, end_date),
    INDEX idx_camp_batch (import_batch_id)
) ENGINE=InnoDB;

-- ============================================================
-- 12. CHANNEL MAPPING (Source+Medium → Channel Group)
-- ============================================================
CREATE TABLE IF NOT EXISTS channel_mapping (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source VARCHAR(255) NOT NULL,
    medium VARCHAR(255) NOT NULL,
    channel_group VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_source_medium (source, medium)
) ENGINE=InnoDB;

-- ============================================================
-- 13. IMPORT LOGS (Data Import History)
-- ============================================================
CREATE TABLE IF NOT EXISTS import_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(10) NOT NULL COMMENT 'csv, xlsx, json',
    target_table VARCHAR(100) NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    imported_rows INT NOT NULL DEFAULT 0,
    error_rows INT NOT NULL DEFAULT 0,
    duplicate_rows INT NOT NULL DEFAULT 0,
    status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    error_message TEXT NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    user_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_import_status (status),
    INDEX idx_import_table (target_table),
    INDEX idx_import_user (user_id)
) ENGINE=InnoDB;

-- ============================================================
-- 14. IMPORT ERRORS (Row-level Import Errors)
-- ============================================================
CREATE TABLE IF NOT EXISTS import_errors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    import_log_id INT NOT NULL,
    row_number INT NOT NULL,
    column_name VARCHAR(255) NULL,
    error_type VARCHAR(100) NOT NULL COMMENT 'type_mismatch, missing_required, duplicate, invalid_format',
    error_message TEXT NULL,
    raw_value TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_imperr_log (import_log_id),
    CONSTRAINT fk_imperr_log FOREIGN KEY (import_log_id) REFERENCES import_logs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 15. AUDIT LOG (System Activity Tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL COMMENT 'login, import, export, filter, etc.',
    entity_type VARCHAR(100) NULL,
    entity_id VARCHAR(255) NULL,
    details JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_date (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- 16. KPI AGGREGATIONS (Pre-computed KPI Cache)
-- ============================================================
CREATE TABLE IF NOT EXISTS kpi_aggregations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    kpi_type VARCHAR(100) NOT NULL COMMENT 'traffic, ads, sales, marketing',
    kpi_name VARCHAR(255) NOT NULL,
    dimension_key VARCHAR(500) NULL COMMENT 'e.g. channel:Organic Search, campaign:SP_xxx',
    period_type VARCHAR(20) NOT NULL COMMENT 'daily, weekly, monthly',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    value DECIMAL(20,4) NOT NULL,
    previous_value DECIMAL(20,4) NULL,
    change_percent DECIMAL(10,4) NULL,
    metadata JSON NULL,
    computed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_kpi_type (kpi_type, kpi_name),
    INDEX idx_kpi_period (period_type, period_start, period_end),
    INDEX idx_kpi_dimension (dimension_key(255)),
    UNIQUE KEY uk_kpi_unique (kpi_type, kpi_name, dimension_key(255), period_type, period_start)
) ENGINE=InnoDB;
