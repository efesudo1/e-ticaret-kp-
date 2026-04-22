const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const XLSX = require('xlsx');
const db = require('../config/database');

// Column mapping definitions for each table
// Maps source CSV headers → database column names
const TABLE_SCHEMAS = {
  ga4_traffic: {
    columns: {
      'date': { dbColumn: 'date', type: 'string', required: true },
      'sessionSource': { dbColumn: 'sessionSource', type: 'string', required: false },
      'sessionMedium': { dbColumn: 'sessionMedium', type: 'string', required: false },
      'sessionCampaignName': { dbColumn: 'sessionCampaignName', type: 'string', required: false },
      'sessionDefaultChannelGroup': { dbColumn: 'sessionDefaultChannelGroup', type: 'string', required: false },
      'deviceCategory': { dbColumn: 'deviceCategory', type: 'string', required: false },
      'city': { dbColumn: 'city', type: 'string', required: false },
      'landingPagePlusQueryString': { dbColumn: 'landingPagePlusQueryString', type: 'string', required: false },
      'newVsReturning': { dbColumn: 'newVsReturning', type: 'string', required: false },
      'sessions': { dbColumn: 'sessions', type: 'integer', required: true },
      'totalUsers': { dbColumn: 'totalUsers', type: 'integer', required: false },
      'newUsers': { dbColumn: 'newUsers', type: 'integer', required: false },
      'bounceRate': { dbColumn: 'bounceRate', type: 'float', required: false },
      'averageSessionDuration': { dbColumn: 'averageSessionDuration', type: 'float', required: false },
      'screenPageViewsPerSession': { dbColumn: 'screenPageViewsPerSession', type: 'float', required: false },
      'engagedSessions': { dbColumn: 'engagedSessions', type: 'integer', required: false },
      'engagementRate': { dbColumn: 'engagementRate', type: 'float', required: false },
      'userEngagementDuration': { dbColumn: 'userEngagementDuration', type: 'float', required: false },
      'conversions': { dbColumn: 'conversions', type: 'integer', required: false },
      'purchaseRevenue': { dbColumn: 'purchaseRevenue', type: 'float', required: false },
      'transactions': { dbColumn: 'transactions', type: 'integer', required: false },
    },
    detectKeywords: ['sessionSource', 'sessionMedium', 'bounceRate', 'engagementRate']
  },
  ga4_item_interactions: {
    columns: {
      'date': { dbColumn: 'date', type: 'string', required: true },
      'itemId': { dbColumn: 'itemId', type: 'string', required: true },
      'itemName': { dbColumn: 'itemName', type: 'string', required: false },
      'itemCategory': { dbColumn: 'itemCategory', type: 'string', required: false },
      'itemCategory2': { dbColumn: 'itemCategory2', type: 'string', required: false },
      'itemBrand': { dbColumn: 'itemBrand', type: 'string', required: false },
      'itemsViewed': { dbColumn: 'itemsViewed', type: 'integer', required: false },
      'itemsAddedToCart': { dbColumn: 'itemsAddedToCart', type: 'integer', required: false },
      'itemsCheckedOut': { dbColumn: 'itemsCheckedOut', type: 'integer', required: false },
      'itemsPurchased': { dbColumn: 'itemsPurchased', type: 'integer', required: false },
      'itemRevenue': { dbColumn: 'itemRevenue', type: 'float', required: false },
      'itemListViews': { dbColumn: 'itemListViews', type: 'integer', required: false },
      'itemListClicks': { dbColumn: 'itemListClicks', type: 'integer', required: false },
      'cartToViewRate': { dbColumn: 'cartToViewRate', type: 'float', required: false },
    },
    detectKeywords: ['itemId', 'itemsViewed', 'itemsAddedToCart', 'cartToViewRate']
  },
  meta_ads: {
    columns: {
      'date_start': { dbColumn: 'date_start', type: 'date', required: true },
      'date_stop': { dbColumn: 'date_stop', type: 'date', required: true },
      'account_id': { dbColumn: 'account_id', type: 'string', required: false },
      'account_name': { dbColumn: 'account_name', type: 'string', required: false },
      'campaign_id': { dbColumn: 'campaign_id', type: 'string', required: false },
      'campaign_name': { dbColumn: 'campaign_name', type: 'string', required: false },
      'adset_id': { dbColumn: 'adset_id', type: 'string', required: false },
      'adset_name': { dbColumn: 'adset_name', type: 'string', required: false },
      'ad_id': { dbColumn: 'ad_id', type: 'string', required: false },
      'ad_name': { dbColumn: 'ad_name', type: 'string', required: false },
      'objective': { dbColumn: 'objective', type: 'string', required: false },
      'buying_type': { dbColumn: 'buying_type', type: 'string', required: false },
      'impressions': { dbColumn: 'impressions', type: 'integer', required: false },
      'reach': { dbColumn: 'reach', type: 'integer', required: false },
      'frequency': { dbColumn: 'frequency', type: 'float', required: false },
      'clicks': { dbColumn: 'clicks', type: 'integer', required: false },
      'inline_link_clicks': { dbColumn: 'inline_link_clicks', type: 'integer', required: false },
      'spend': { dbColumn: 'spend', type: 'float', required: false },
      'cpc': { dbColumn: 'cpc', type: 'float', required: false },
      'cpm': { dbColumn: 'cpm', type: 'float', required: false },
      'cpp': { dbColumn: 'cpp', type: 'float', required: false },
      'ctr': { dbColumn: 'ctr', type: 'float', required: false },
      'inline_link_click_ctr': { dbColumn: 'inline_link_click_ctr', type: 'float', required: false },
      'actions:link_click': { dbColumn: 'actions_link_click', type: 'integer', required: false },
      'actions:landing_page_view': { dbColumn: 'actions_landing_page_view', type: 'integer', required: false },
      'actions:offsite_conversion.fb_pixel_view_content': { dbColumn: 'actions_view_content', type: 'integer', required: false },
      'actions:offsite_conversion.fb_pixel_add_to_cart': { dbColumn: 'actions_add_to_cart', type: 'integer', required: false },
      'actions:offsite_conversion.fb_pixel_initiate_checkout': { dbColumn: 'actions_initiate_checkout', type: 'integer', required: false },
      'actions:offsite_conversion.fb_pixel_purchase': { dbColumn: 'actions_purchase', type: 'integer', required: false },
      'action_values:offsite_conversion.fb_pixel_purchase': { dbColumn: 'action_values_purchase', type: 'float', required: false },
      'actions:page_engagement': { dbColumn: 'actions_page_engagement', type: 'integer', required: false },
      'actions:post_engagement': { dbColumn: 'actions_post_engagement', type: 'integer', required: false },
      'actions:video_view': { dbColumn: 'actions_video_view', type: 'integer', required: false },
    },
    detectKeywords: ['adset_name', 'inline_link_clicks', 'actions:link_click', 'actions:landing_page_view']
  },
  meta_ads_breakdowns: {
    columns: {
      'date_start': { dbColumn: 'date_start', type: 'date', required: true },
      'date_stop': { dbColumn: 'date_stop', type: 'date', required: true },
      'campaign_name': { dbColumn: 'campaign_name', type: 'string', required: false },
      'adset_name': { dbColumn: 'adset_name', type: 'string', required: false },
      'ad_name': { dbColumn: 'ad_name', type: 'string', required: false },
      'publisher_platform': { dbColumn: 'publisher_platform', type: 'string', required: false },
      'platform_position': { dbColumn: 'platform_position', type: 'string', required: false },
      'impression_device': { dbColumn: 'impression_device', type: 'string', required: false },
      'impressions': { dbColumn: 'impressions', type: 'integer', required: false },
      'clicks': { dbColumn: 'clicks', type: 'integer', required: false },
      'spend': { dbColumn: 'spend', type: 'float', required: false },
    },
    detectKeywords: ['publisher_platform', 'platform_position', 'impression_device']
  },
  google_ads: {
    columns: {
      'segments.date': { dbColumn: 'date', type: 'date', required: true },
      'customer.id': { dbColumn: 'customer_id', type: 'string', required: false },
      'customer.descriptive_name': { dbColumn: 'customer_descriptive_name', type: 'string', required: false },
      'campaign.id': { dbColumn: 'campaign_id', type: 'string', required: false },
      'campaign.name': { dbColumn: 'campaign_name', type: 'string', required: false },
      'campaign.status': { dbColumn: 'campaign_status', type: 'string', required: false },
      'campaign.advertising_channel_type': { dbColumn: 'advertising_channel_type', type: 'string', required: false },
      'ad_group.id': { dbColumn: 'ad_group_id', type: 'string', required: false },
      'ad_group.name': { dbColumn: 'ad_group_name', type: 'string', required: false },
      'ad_group.status': { dbColumn: 'ad_group_status', type: 'string', required: false },
      'segments.device': { dbColumn: 'device', type: 'string', required: false },
      'segments.ad_network_type': { dbColumn: 'ad_network_type', type: 'string', required: false },
      'segments.product_item_id': { dbColumn: 'product_item_id', type: 'string', required: false },
      'segments.product_title': { dbColumn: 'product_title', type: 'string', required: false },
      'segments.product_brand': { dbColumn: 'product_brand', type: 'string', required: false },
      'segments.product_type_l1': { dbColumn: 'product_type_l1', type: 'string', required: false },
      'segments.product_type_l2': { dbColumn: 'product_type_l2', type: 'string', required: false },
      'ad_group_criterion.keyword.text': { dbColumn: 'keyword_text', type: 'string', required: false },
      'ad_group_criterion.keyword.match_type': { dbColumn: 'keyword_match_type', type: 'string', required: false },
      'metrics.impressions': { dbColumn: 'impressions', type: 'integer', required: false },
      'metrics.clicks': { dbColumn: 'clicks', type: 'integer', required: false },
      'metrics.cost_micros': { dbColumn: 'cost_micros', type: 'integer', required: false },
      'metrics.ctr': { dbColumn: 'ctr', type: 'float', required: false },
      'metrics.average_cpc': { dbColumn: 'average_cpc', type: 'integer', required: false },
      'metrics.average_cpm': { dbColumn: 'average_cpm', type: 'integer', required: false },
      'metrics.conversions': { dbColumn: 'conversions', type: 'float', required: false },
      'metrics.conversions_value': { dbColumn: 'conversions_value', type: 'float', required: false },
      'metrics.all_conversions': { dbColumn: 'all_conversions', type: 'float', required: false },
      'metrics.all_conversions_value': { dbColumn: 'all_conversions_value', type: 'float', required: false },
      'metrics.cost_per_conversion': { dbColumn: 'cost_per_conversion', type: 'integer', required: false },
      'metrics.conversions_from_interactions_rate': { dbColumn: 'conversions_from_interactions_rate', type: 'float', required: false },
      'metrics.value_per_conversion': { dbColumn: 'value_per_conversion', type: 'float', required: false },
      'metrics.search_impression_share': { dbColumn: 'search_impression_share', type: 'float', required: false },
      'metrics.search_budget_lost_impression_share': { dbColumn: 'search_budget_lost_impression_share', type: 'float', required: false },
      'metrics.search_rank_lost_impression_share': { dbColumn: 'search_rank_lost_impression_share', type: 'float', required: false },
      'metrics.view_through_conversions': { dbColumn: 'view_through_conversions', type: 'integer', required: false },
      'metrics.interaction_rate': { dbColumn: 'interaction_rate', type: 'float', required: false },
    },
    detectKeywords: ['segments.date', 'campaign.name', 'metrics.cost_micros', 'metrics.impressions']
  },
  orders: {
    columns: {
      'order_id': { dbColumn: 'order_id', type: 'string', required: true },
      'order_date': { dbColumn: 'order_date', type: 'datetime', required: true },
      'customer_id': { dbColumn: 'customer_id', type: 'string', required: true },
      'city': { dbColumn: 'city', type: 'string', required: false },
      'device': { dbColumn: 'device', type: 'string', required: false },
      'channel': { dbColumn: 'channel', type: 'string', required: false },
      'source': { dbColumn: 'source', type: 'string', required: false },
      'medium': { dbColumn: 'medium', type: 'string', required: false },
      'campaign_name': { dbColumn: 'campaign_name', type: 'string', required: false },
      'coupon_code': { dbColumn: 'coupon_code', type: 'string', required: false },
      'product_count': { dbColumn: 'product_count', type: 'integer', required: false },
      'order_revenue': { dbColumn: 'order_revenue', type: 'float', required: true },
      'shipping_cost': { dbColumn: 'shipping_cost', type: 'float', required: false },
      'discount_amount': { dbColumn: 'discount_amount', type: 'float', required: false },
      'refund_amount': { dbColumn: 'refund_amount', type: 'float', required: false },
      'net_revenue': { dbColumn: 'net_revenue', type: 'float', required: false },
      'order_status': { dbColumn: 'order_status', type: 'string', required: false },
      'payment_method': { dbColumn: 'payment_method', type: 'string', required: false },
    },
    detectKeywords: ['order_id', 'order_date', 'order_revenue', 'customer_id'],
    duplicateKey: ['order_id']
  },
  order_items: {
    columns: {
      'order_id': { dbColumn: 'order_id', type: 'string', required: true },
      'line_id': { dbColumn: 'line_id', type: 'integer', required: true },
      'item_id': { dbColumn: 'item_id', type: 'string', required: true },
      'item_name': { dbColumn: 'item_name', type: 'string', required: false },
      'item_category': { dbColumn: 'item_category', type: 'string', required: false },
      'item_category2': { dbColumn: 'item_category2', type: 'string', required: false },
      'item_brand': { dbColumn: 'item_brand', type: 'string', required: false },
      'quantity': { dbColumn: 'quantity', type: 'integer', required: false },
      'unit_price': { dbColumn: 'unit_price', type: 'float', required: false },
      'line_total': { dbColumn: 'line_total', type: 'float', required: false },
      'discount_amount': { dbColumn: 'discount_amount', type: 'float', required: false },
      'refund_amount': { dbColumn: 'refund_amount', type: 'float', required: false },
    },
    detectKeywords: ['order_id', 'line_id', 'item_id', 'unit_price', 'line_total'],
    duplicateKey: ['order_id', 'line_id']
  },
  products: {
    columns: {
      'sku': { dbColumn: 'sku', type: 'string', required: true },
      'product_name': { dbColumn: 'product_name', type: 'string', required: true },
      'category': { dbColumn: 'category', type: 'string', required: false },
      'sub_category': { dbColumn: 'sub_category', type: 'string', required: false },
      'brand': { dbColumn: 'brand', type: 'string', required: false },
      'gender': { dbColumn: 'gender', type: 'string', required: false },
      'price': { dbColumn: 'price', type: 'float', required: false },
      'cost_price': { dbColumn: 'cost_price', type: 'float', required: false },
      'stock_quantity': { dbColumn: 'stock_quantity', type: 'integer', required: false },
      'is_active': { dbColumn: 'is_active', type: 'boolean', required: false },
      'created_at': { dbColumn: 'created_at', type: 'date', required: false },
      'color': { dbColumn: 'color', type: 'string', required: false },
      'size_range': { dbColumn: 'size_range', type: 'string', required: false },
    },
    detectKeywords: ['sku', 'product_name', 'cost_price', 'stock_quantity'],
    duplicateKey: ['sku']
  },
  customers: {
    columns: {
      'customer_id': { dbColumn: 'customer_id', type: 'string', required: true },
      'customer_name': { dbColumn: 'customer_name', type: 'string', required: false },
      'first_order_date': { dbColumn: 'first_order_date', type: 'date', required: false },
      'registration_date': { dbColumn: 'registration_date', type: 'date', required: false },
      'city': { dbColumn: 'city', type: 'string', required: false },
      'gender': { dbColumn: 'gender', type: 'string', required: false },
      'age_group': { dbColumn: 'age_group', type: 'string', required: false },
      'registration_source': { dbColumn: 'registration_source', type: 'string', required: false },
      'is_newsletter_subscriber': { dbColumn: 'is_newsletter_subscriber', type: 'boolean', required: false },
      'total_orders': { dbColumn: 'total_orders', type: 'integer', required: false },
      'total_revenue': { dbColumn: 'total_revenue', type: 'float', required: false },
      'last_order_date': { dbColumn: 'last_order_date', type: 'date', required: false },
    },
    detectKeywords: ['customer_id', 'first_order_date', 'age_group', 'registration_source'],
    duplicateKey: ['customer_id']
  },
  campaigns: {
    columns: {
      'campaign_name': { dbColumn: 'campaign_name', type: 'string', required: true },
      'platform': { dbColumn: 'platform', type: 'string', required: true },
      'campaign_type': { dbColumn: 'campaign_type', type: 'string', required: false },
      'objective': { dbColumn: 'objective', type: 'string', required: false },
      'start_date': { dbColumn: 'start_date', type: 'date', required: false },
      'end_date': { dbColumn: 'end_date', type: 'date', required: false },
      'daily_budget': { dbColumn: 'daily_budget', type: 'float', required: false },
      'total_budget': { dbColumn: 'total_budget', type: 'float', required: false },
      'target_audience': { dbColumn: 'target_audience', type: 'string', required: false },
      'status': { dbColumn: 'status', type: 'string', required: false },
    },
    detectKeywords: ['campaign_name', 'platform', 'campaign_type', 'daily_budget', 'total_budget'],
    duplicateKey: ['campaign_name']
  },
  channel_mapping: {
    columns: {
      'source': { dbColumn: 'source', type: 'string', required: true },
      'medium': { dbColumn: 'medium', type: 'string', required: true },
      'channel_group': { dbColumn: 'channel_group', type: 'string', required: true },
    },
    detectKeywords: ['source', 'medium', 'channel_group'],
    duplicateKey: ['source', 'medium']
  }
};

class ImportService {
  /**
   * Parse file and return preview data
   */
  async parseFilePreview(filePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();
    let data;

    if (ext === '.csv') {
      data = await this.parseCSV(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      data = this.parseExcel(filePath);
    } else if (ext === '.json') {
      data = this.parseJSON(filePath);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    // Clean BOM from headers
    if (data.length > 0) {
      const firstRow = data[0];
      const keys = Object.keys(firstRow);
      if (keys.length > 0 && keys[0].startsWith('\ufeff')) {
        const newKey = keys[0].replace('\ufeff', '');
        data = data.map(row => {
          const newRow = {};
          for (const [k, v] of Object.entries(row)) {
            newRow[k.replace('\ufeff', '')] = v;
          }
          return newRow;
        });
      }
    }

    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    const detectedTable = this.detectTargetTable(columns);

    return {
      totalRows: data.length,
      columns,
      sampleData: data.slice(0, 10),
      detectedTable
    };
  }

  /**
   * Parse CSV file
   */
  parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error)
      });
    });
  }

  /**
   * Parse Excel file
   */
  parseExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  /**
   * Parse JSON file
   */
  parseJSON(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  /**
   * Auto-detect target table from column names
   */
  detectTargetTable(columns) {
    const cleanedColumns = columns.map(c => c.replace('\ufeff', '').toLowerCase());
    let bestMatch = null;
    let bestScore = 0;

    for (const [tableName, schema] of Object.entries(TABLE_SCHEMAS)) {
      let score = 0;
      const schemaColumns = Object.keys(schema.columns).map(c => c.toLowerCase());
      
      for (const col of cleanedColumns) {
        if (schemaColumns.includes(col)) {
          score += 2;
        }
      }

      // Bonus for detect keywords
      for (const kw of schema.detectKeywords) {
        if (cleanedColumns.includes(kw.toLowerCase())) {
          score += 5;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = tableName;
      }
    }

    return bestMatch;
  }

  /**
   * Get column mapping suggestions for a target table
   */
  getColumnMappingSuggestions(targetTable) {
    const schema = TABLE_SCHEMAS[targetTable];
    if (!schema) return {};
    return schema.columns;
  }

  /**
   * Execute the actual import
   */
  async executeImport(filePath, targetTable, columnMapping, importId) {
    const schema = TABLE_SCHEMAS[targetTable];
    if (!schema) {
      throw new Error(`Unknown target table: ${targetTable}`);
    }

    // Parse the full file
    const originalName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let rawData;

    if (ext === '.csv') {
      rawData = await this.parseCSV(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      rawData = this.parseExcel(filePath);
    } else {
      rawData = this.parseJSON(filePath);
    }

    // Clean BOM from headers
    rawData = rawData.map(row => {
      const newRow = {};
      for (const [k, v] of Object.entries(row)) {
        newRow[k.replace('\ufeff', '')] = v;
      }
      return newRow;
    });

    let importedRows = 0;
    let errorRows = 0;
    let duplicateRows = 0;
    const errors = [];

    // Build final column mapping
    const finalMapping = columnMapping || this.buildAutoMapping(Object.keys(rawData[0] || {}), schema);

    // Process in batches of 500
    const batchSize = 500;
    for (let i = 0; i < rawData.length; i += batchSize) {
      const batch = rawData.slice(i, i + batchSize);
      const validRows = [];

      for (let j = 0; j < batch.length; j++) {
        const rowIndex = i + j + 1; // 1-indexed (header = row 0)
        const row = batch[j];
        const result = this.transformAndValidateRow(row, schema, finalMapping, rowIndex);

        if (result.errors.length > 0) {
          errorRows++;
          for (const err of result.errors) {
            errors.push(err);
            // Log to import_errors table
            try {
              await db.query(
                `INSERT INTO import_errors (import_log_id, row_number, column_name, error_type, error_message, raw_value)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [importId, err.row, err.column, err.type, err.message, err.value]
              );
            } catch (e) { /* ignore logging errors */ }
          }
        } else {
          validRows.push(result.data);
        }
      }

      // Insert valid rows
      if (validRows.length > 0) {
        const insertResult = await this.insertBatch(targetTable, validRows, schema, importId);
        importedRows += insertResult.inserted;
        duplicateRows += insertResult.duplicates;
      }
    }

    return { importedRows, errorRows, duplicateRows, errors };
  }

  /**
   * Build automatic column mapping based on header matching
   */
  buildAutoMapping(sourceColumns, schema) {
    const mapping = {};
    const schemaKeys = Object.keys(schema.columns);

    for (const srcCol of sourceColumns) {
      const cleanSrc = srcCol.replace('\ufeff', '');
      // Direct match
      if (schemaKeys.includes(cleanSrc)) {
        mapping[cleanSrc] = cleanSrc;
        continue;
      }
      // Case-insensitive match
      const match = schemaKeys.find(k => k.toLowerCase() === cleanSrc.toLowerCase());
      if (match) {
        mapping[cleanSrc] = match;
      }
    }

    return mapping;
  }

  /**
   * Transform and validate a single row
   */
  transformAndValidateRow(row, schema, mapping, rowIndex) {
    const data = {};
    const errors = [];

    for (const [sourceCol, targetCol] of Object.entries(mapping)) {
      const colDef = schema.columns[targetCol];
      if (!colDef) continue;

      let value = row[sourceCol];

      // Handle empty/null values
      if (value === undefined || value === null || value === '') {
        if (colDef.required) {
          errors.push({
            row: rowIndex,
            column: sourceCol,
            type: 'missing_required',
            message: `Required field '${sourceCol}' is empty`,
            value: ''
          });
        }
        data[colDef.dbColumn] = null;
        continue;
      }

      // Type conversion and validation
      try {
        value = String(value).trim();
        
        switch (colDef.type) {
          case 'integer':
            const intVal = parseInt(value, 10);
            if (isNaN(intVal)) {
              errors.push({
                row: rowIndex,
                column: sourceCol,
                type: 'type_mismatch',
                message: `Expected integer, got '${value}'`,
                value
              });
              data[colDef.dbColumn] = 0;
            } else {
              data[colDef.dbColumn] = intVal;
            }
            break;

          case 'float':
            const floatVal = parseFloat(value);
            if (isNaN(floatVal)) {
              errors.push({
                row: rowIndex,
                column: sourceCol,
                type: 'type_mismatch',
                message: `Expected number, got '${value}'`,
                value
              });
              data[colDef.dbColumn] = 0;
            } else {
              data[colDef.dbColumn] = floatVal;
            }
            break;

          case 'date':
            // Handle various date formats
            const dateVal = this.parseDate(value);
            if (!dateVal) {
              errors.push({
                row: rowIndex,
                column: sourceCol,
                type: 'invalid_format',
                message: `Invalid date format: '${value}'`,
                value
              });
              data[colDef.dbColumn] = null;
            } else {
              data[colDef.dbColumn] = dateVal;
            }
            break;

          case 'datetime':
            data[colDef.dbColumn] = value;
            break;

          case 'boolean':
            const boolVal = ['true', '1', 'yes', 'evet'].includes(value.toLowerCase());
            data[colDef.dbColumn] = boolVal;
            break;

          default:
            data[colDef.dbColumn] = value;
        }
      } catch (e) {
        errors.push({
          row: rowIndex,
          column: sourceCol,
          type: 'parse_error',
          message: e.message,
          value: String(value)
        });
      }
    }

    return { data, errors };
  }

  /**
   * Parse various date formats
   */
  parseDate(value) {
    if (!value) return null;
    value = String(value).trim();

    // YYYYMMDD (GA4 format)
    if (/^\d{8}$/.test(value)) {
      return `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
    }
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [d, m, y] = value.split('/');
      return `${y}-${m}-${d}`;
    }
    // DD.MM.YYYY
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
      const [d, m, y] = value.split('.');
      return `${y}-${m}-${d}`;
    }
    // Try Date parse
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return null;
  }

  async insertBatch(targetTable, rows, schema, importId) {
    if (!rows.length) return { inserted: 0, duplicates: 0 };

    const columns = Object.keys(rows[0]).filter(c => c !== null && c !== undefined);
    columns.push('import_batch_id');

    const columnList = columns.map(c => `\`${c}\``).join(', ');

    const valuesArray = rows.map(row => {
      return columns.map(c => {
        if (c === 'import_batch_id') return importId;
        return row[c] !== undefined ? row[c] : null;
      });
    });

    try {
      const hasDuplicateKey = schema.duplicateKey && schema.duplicateKey.length > 0;
      const sql = hasDuplicateKey
        ? `INSERT IGNORE INTO \`${targetTable}\` (${columnList}) VALUES ?`
        : `INSERT INTO \`${targetTable}\` (${columnList}) VALUES ?`;

      const [result] = await db.query(sql, [valuesArray]);
      
      const inserted = result.affectedRows || 0;
      const duplicates = rows.length - inserted;

      return { inserted, duplicates };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return { inserted: 0, duplicates: rows.length };
      }
      throw error;
    }
  }
}

module.exports = ImportService;
