/**
 * OmniCRM Sync — AI Engine
 * Claude API integration for message categorization, summarization, and suggestions.
 * Uses raw fetch() — no SDK dependency. Service worker only.
 */

class AIEngine {
  constructor() {
    this.apiUrl = 'https://api.anthropic.com/v1/messages';
    this.model = 'claude-haiku-4-5-20251001';
    this.apiVersion = '2023-06-01';
    this.maxTokens = 150;
    this.batchDebounceMs = 5000;
    this.maxBatchSize = 10;
    this.pendingBatch = [];
    this.batchTimer = null;
    this.log = typeof OmniCRM !== 'undefined'
      ? new OmniCRM.OmniLog('ai')
      : { info: console.info.bind(console), warn: console.warn.bind(console), error: console.error.bind(console), debug: console.debug.bind(console) };

    this.CATEGORIZATION_PROMPT = `You are a customer message classifier for a multi-platform CRM. Categorize each message into exactly ONE category.

Categories:
- complaint: Customer expressing dissatisfaction, reporting problems
- question: General inquiries, asking for information
- order_inquiry: Questions about orders, shipping, tracking, delivery
- feedback: Positive comments, reviews, suggestions
- urgent: Messages requiring immediate attention (threats, legal, safety)
- greeting: Simple hellos, conversation starters
- closing: Goodbyes, thank yous, conversation endings
- other: Messages that don't fit above categories

Respond with JSON only: {"category": "...", "confidence": 0.0-1.0, "sentiment": "positive|neutral|negative"}`;

    this.SUMMARY_PROMPT = `Summarize this customer conversation in 1-2 sentences for a CRM note. Include: key topic, customer sentiment, any action items. Be concise and professional.`;

    this.REPLY_PROMPT = `Suggest 2-3 short professional reply templates for this customer message. Consider the platform context. Return JSON array: [{"text": "...", "tone": "friendly|professional|apologetic"}]`;
  }

  /**
   * Get API key from session storage.
   * @returns {Promise<string|null>}
   */
  async _getApiKey() {
    try {
      const result = await chrome.storage.session.get('claudeApiKey');
      return result.claudeApiKey || null;
    } catch (e) {
      this.log.error('Failed to get API key:', e.message);
      return null;
    }
  }

  /**
   * Make a Claude API call.
   * @param {string} systemPrompt
   * @param {string} userMessage
   * @returns {Promise<Object|null>}
   */
  async _callAPI(systemPrompt, userMessage) {
    const apiKey = await this._getApiKey();
    if (!apiKey) {
      this.log.warn('No API key configured — skipping AI call');
      return null;
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': this.apiVersion,
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          system: [{
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' }
          }],
          messages: [{ role: 'user', content: userMessage }]
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        this.log.error(`API error ${response.status}:`, errBody);
        return null;
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      // Try to parse as JSON
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    } catch (err) {
      this.log.error('API call failed:', err.message);
      return null;
    }
  }

  /**
   * Categorize a single message.
   * Uses cache to avoid re-processing.
   * @param {string} text - Message text
   * @param {string} platform - Platform ID
   * @param {QueueManager} queueManager - For cache access
   * @returns {Promise<Object|null>}
   */
  async categorizeMessage(text, platform, queueManager) {
    if (!text || text.length < 3) return null;

    // Check cache
    const hash = typeof OmniCRM !== 'undefined'
      ? OmniCRM.contentHash(text)
      : text.substring(0, 50);

    if (queueManager) {
      const cached = await queueManager.getCachedAI(hash);
      if (cached) {
        this.log.debug('Cache hit for categorization');
        return cached;
      }
    }

    const result = await this._callAPI(
      this.CATEGORIZATION_PROMPT,
      `Platform: ${platform}\nMessage: "${text}"`
    );

    // Cache result
    if (result && queueManager) {
      await queueManager.setCachedAI(hash, result);
    }

    return result;
  }

  /**
   * Summarize a conversation (array of messages).
   * @param {Object[]} messages - Array of interaction events
   * @returns {Promise<string|null>}
   */
  async summarizeConversation(messages) {
    if (!messages || messages.length === 0) return null;

    const conversationText = messages
      .map(m => `[${m.direction}] ${m.sender?.name || 'Unknown'}: ${m.content?.text || ''}`)
      .join('\n');

    const result = await this._callAPI(this.SUMMARY_PROMPT, conversationText);
    return result?.raw || result?.summary || null;
  }

  /**
   * Suggest reply templates for a message.
   * @param {string} text - The incoming message
   * @param {string} platform
   * @returns {Promise<Object[]|null>}
   */
  async suggestReply(text, platform) {
    if (!text) return null;

    const result = await this._callAPI(
      this.REPLY_PROMPT,
      `Platform: ${platform}\nCustomer message: "${text}"`
    );

    return Array.isArray(result) ? result : null;
  }

  /**
   * Score a lead based on conversation sentiment.
   * @param {Object[]} messages - Recent messages from this contact
   * @returns {Promise<Object|null>} { score: 1-10, reasoning: string }
   */
  async scoreLead(messages) {
    if (!messages || messages.length === 0) return null;

    const conversationText = messages
      .slice(-10) // Last 10 messages only
      .map(m => `[${m.direction}] ${m.content?.text || ''}`)
      .join('\n');

    return await this._callAPI(
      `Score this sales lead from 1 (cold) to 10 (hot) based on the conversation. Return JSON: {"score": N, "reasoning": "..."}`,
      conversationText
    );
  }

  /**
   * Check if AI is enabled and configured.
   * @returns {Promise<boolean>}
   */
  async isEnabled() {
    try {
      const config = await chrome.storage.local.get('ai');
      const apiKey = await this._getApiKey();
      return !!(config.ai?.enabled && apiKey);
    } catch {
      return false;
    }
  }
}

if (typeof self !== 'undefined') {
  self.AIEngine = AIEngine;
}
if (typeof window !== 'undefined' && typeof OmniCRM !== 'undefined') {
  OmniCRM.AIEngine = AIEngine;
}
