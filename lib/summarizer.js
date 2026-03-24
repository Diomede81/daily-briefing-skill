/**
 * AI Summarization Module
 * Generates concise, relevant summaries of briefing content
 * using OpenAI GPT models
 */

const TOKEN_MANAGER_API = 'http://localhost:3021';

/**
 * Summarize and prioritize content items
 * 
 * @param {Array} sections - Array of {name, type, items[]} from adapters
 * @param {Object} config - Summarization configuration
 * @param {string} config.style - 'concise' | 'detailed' | 'bullets'
 * @param {number} config.maxItemsPerSource - Limit items per source
 * @param {string} config.prioritize - 'latest' | 'relevance' | 'all'
 * @param {string} config.userContext - Context about user's interests
 * @returns {Promise<Array>} Enhanced sections with AI summaries
 */
async function summarizeSections(sections, config = {}) {
  const {
    style = 'concise',
    maxItemsPerSource = 5,
    prioritize = 'relevance',
    userContext = 'Tech entrepreneur interested in AI, business automation, healthcare technology, and productivity tools'
  } = config;

  // Get OpenAI API key
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    console.warn('⚠️ OpenAI API key not found - skipping AI summarization');
    return sections; // Return original sections unchanged
  }

  console.log('🤖 AI Summarization enabled');
  
  const enhancedSections = [];

  for (const section of sections) {
    console.log(`   Processing: ${section.name} (${section.items.length} items)`);
    
    // Filter and limit items per source
    let items = section.items.slice(0, maxItemsPerSource);
    
    // Skip summarization for certain types (already well-formatted)
    if (['calendar', 'tasks', 'weather'].includes(section.type)) {
      enhancedSections.push(section);
      continue;
    }

    try {
      // Summarize items in batch for efficiency
      const enhancedItems = await summarizeItems(items, section, {
        style,
        userContext,
        apiKey
      });

      enhancedSections.push({
        ...section,
        items: enhancedItems
      });

      console.log(`   ✅ Summarized ${enhancedItems.length} items`);
    } catch (err) {
      console.warn(`   ⚠️ Summarization failed: ${err.message}`);
      // Fallback to original items
      enhancedSections.push(section);
    }
  }

  return enhancedSections;
}

/**
 * Summarize a batch of items using GPT
 */
async function summarizeItems(items, section, options) {
  const { style, userContext, apiKey } = options;

  // Build prompt for GPT
  const prompt = buildSummarizationPrompt(items, section, style, userContext);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Fast and cost-effective
      messages: [
        {
          role: 'system',
          content: 'You are a skilled content analyst creating daily briefing summaries. Your summaries are concise, actionable, and highlight what matters most to the reader.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for consistent summaries
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const summaryText = result.choices[0].message.content;

  // Parse the structured response
  return parseSummaryResponse(summaryText, items);
}

/**
 * Build prompt for GPT summarization
 */
function buildSummarizationPrompt(items, section, style, userContext) {
  const styleInstructions = {
    'concise': 'Write 2-3 sentence summaries focusing on key insights and relevance.',
    'detailed': 'Write 4-5 sentence summaries with context, implications, and action items.',
    'bullets': 'Write bullet-point summaries with main points and takeaways.'
  };

  let prompt = `You are analyzing content for a daily briefing.

**User Context:** ${userContext}

**Source:** ${section.name} (${section.type})

**Style:** ${styleInstructions[style]}

**Task:** For each item below, provide:
1. A summary highlighting what's important and why it's relevant to the user
2. A relevance score (1-5, where 5 = highly relevant)

**Items to summarize:**

`;

  items.forEach((item, idx) => {
    prompt += `\n[ITEM ${idx + 1}]\n`;
    prompt += `Title: ${item.title}\n`;
    
    if (section.type === 'youtube' && item.fullTranscript) {
      // For YouTube, use full transcript (already limited to maxChars)
      prompt += `Transcript: ${item.fullTranscript}\n`;
    } else if (item.description) {
      prompt += `Description: ${item.description}\n`;
    } else if (item.preview) {
      prompt += `Preview: ${item.preview}\n`;
    }
    
    if (item.author) prompt += `Author: ${item.author}\n`;
  });

  prompt += `\n**Output Format:**
For each item, respond in this exact format:

[ITEM 1]
RELEVANCE: [1-5]
SUMMARY: [Your summary here]

[ITEM 2]
RELEVANCE: [1-5]
SUMMARY: [Your summary here]

Focus on actionable insights, business implications, and why the user should care.`;

  return prompt;
}

/**
 * Parse GPT response into enhanced items
 */
function parseSummaryResponse(summaryText, originalItems) {
  const enhanced = [];
  const itemBlocks = summaryText.split(/\[ITEM \d+\]/i).filter(b => b.trim());

  itemBlocks.forEach((block, idx) => {
    if (idx >= originalItems.length) return; // Safety check

    const relevanceMatch = block.match(/RELEVANCE:\s*(\d+)/i);
    const summaryMatch = block.match(/SUMMARY:\s*(.+?)(?=\n\[|$)/is);

    const relevance = relevanceMatch ? parseInt(relevanceMatch[1]) : 3;
    const aiSummary = summaryMatch ? summaryMatch[1].trim() : null;

    enhanced.push({
      ...originalItems[idx],
      aiSummary,
      relevance
    });
  });

  // Sort by relevance (highest first) if we have scores
  if (enhanced.some(i => i.relevance)) {
    enhanced.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  }

  return enhanced;
}

/**
 * Get OpenAI API key from token manager
 */
async function getOpenAIKey() {
  try {
    const response = await fetch(`${TOKEN_MANAGER_API}/api/search?q=openai`);
    const result = await response.json();
    
    if (!result.success || !result.found) {
      return null;
    }

    const tokenId = result.token.id;
    
    const valueResponse = await fetch(`${TOKEN_MANAGER_API}/api/tokens/${tokenId}/value`);
    const valueResult = await valueResponse.json();
    
    return valueResult.success ? valueResult.value : null;
  } catch (err) {
    console.warn('Failed to fetch OpenAI key:', err.message);
    return null;
  }
}

module.exports = {
  summarizeSections,
  summarizeItems
};
