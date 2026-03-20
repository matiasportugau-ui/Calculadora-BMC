/**
 * OmniCRM Sync — Data Mapper
 * Template-based field mapping for CRM payloads.
 * Supports {{field.path}} resolution with dot-notation.
 */

class DataMapper {
  constructor() {
    this.presets = {
      google_sheets_all_platforms: {
        'Timestamp': '{{timestamp}}',
        'Platform': '{{platform}}',
        'Direction': '{{direction}}',
        'Contact Name': '{{sender.name}}',
        'Contact ID': '{{sender.identifier}}',
        'Message': '{{content.text}}',
        'Message Type': '{{content.type}}',
        'Conversation': '{{conversation.name}}',
        'Conv. Type': '{{conversation.type}}',
        'Order ID': '{{context.orderId}}',
        'Product': '{{context.productTitle}}',
        'Status': '{{status}}',
        'Category': '{{ai.category}}'
      },
      hubspot_contact_note: {
        'properties.firstname': '{{sender.name}}',
        'properties.phone': '{{sender.identifier}}',
        'properties.hs_lead_source': '{{platform}}',
        'note': '{{platform}} | {{direction}} | {{content.text}}'
      },
      notion_database_entry: {
        'Platform': '{{platform}}',
        'Contact': '{{sender.name}}',
        'Message': '{{content.text}}',
        'Direction': '{{direction}}',
        'Timestamp': '{{timestamp}}',
        'Type': '{{content.type}}',
        'Order': '{{context.orderId}}'
      },
      airtable_row: {
        'Platform': '{{platform}}',
        'Contact': '{{sender.name}}',
        'Identifier': '{{sender.identifier}}',
        'Message': '{{content.text}}',
        'Direction': '{{direction}}',
        'Timestamp': '{{timestamp}}',
        'Type': '{{content.type}}',
        'Order ID': '{{context.orderId}}',
        'Product': '{{context.productTitle}}'
      },
      raw_json: null // Send raw interaction object
    };
  }

  /**
   * Resolve a dot-notation path from an object.
   * @param {Object} obj
   * @param {string} path - e.g., "sender.name" or "context.orderId"
   * @returns {*}
   */
  resolvePath(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current != null ? current[key] : null;
    }, obj);
  }

  /**
   * Resolve a template string with {{field.path}} placeholders.
   * @param {string} template
   * @param {Object} data
   * @returns {string}
   */
  resolveTemplate(template, data) {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.resolvePath(data, path.trim());
      return value != null ? String(value) : '';
    });
  }

  /**
   * Map an interaction to a CRM payload using a mapping preset or custom mapping.
   * @param {Object} interaction - Standardized interaction event
   * @param {string|Object} mappingName - Preset name or custom mapping object
   * @returns {Object} Mapped payload
   */
  map(interaction, mappingName = 'google_sheets_all_platforms') {
    // Custom mapping object
    if (typeof mappingName === 'object' && mappingName !== null) {
      return this._applyMapping(interaction, mappingName);
    }

    // Raw JSON preset — return interaction as-is
    if (mappingName === 'raw_json') {
      return interaction;
    }

    // Named preset
    const mapping = this.presets[mappingName];
    if (!mapping) {
      return interaction; // Fallback to raw
    }

    return this._applyMapping(interaction, mapping);
  }

  _applyMapping(interaction, mapping) {
    const result = {};
    for (const [outputKey, template] of Object.entries(mapping)) {
      const value = this.resolveTemplate(template, interaction);
      // Support nested output keys like "properties.firstname"
      this._setNestedValue(result, outputKey, value);
    }

    // Add conditional platform-specific fields
    if (interaction.platform === 'mercadolibre') {
      if (interaction.context.orderId) result['Order ID'] = interaction.context.orderId;
      if (interaction.context.productTitle) result['Product'] = interaction.context.productTitle;
      if (interaction.context.orderStatus) result['Order Status'] = interaction.context.orderStatus;
    }

    if (interaction.platform === 'instagram') {
      if (interaction.sender.identifier) {
        result['Username'] = `@${interaction.sender.identifier}`;
      }
    }

    return result;
  }

  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get available preset names.
   * @returns {string[]}
   */
  getPresetNames() {
    return Object.keys(this.presets);
  }

  /**
   * Get a preset mapping by name.
   * @param {string} name
   * @returns {Object|null}
   */
  getPreset(name) {
    return this.presets[name] || null;
  }
}

if (typeof self !== 'undefined') {
  self.DataMapper = DataMapper;
}
if (typeof window !== 'undefined' && typeof OmniCRM !== 'undefined') {
  OmniCRM.DataMapper = DataMapper;
}
