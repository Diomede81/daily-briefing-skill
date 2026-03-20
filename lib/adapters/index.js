/**
 * Source Adapters
 * Parse different source types (RSS, web-json, email)
 */

const { execSync } = require('child_process');

const MIDDLEWARE_API = process.env.MIDDLEWARE_API || 'http://localhost:3007/api';

/**
 * Test and fetch from an RSS feed
 */
async function fetchRSS(source) {
  const { url, config = {} } = source;
  const maxItems = config.maxItems || 10;

  try {
    const xml = execSync(
      `curl -sL "${url}" --max-time 20 -A "Mozilla/5.0"`,
      { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
    );

    const items = [];
    const itemMatches = xml.split('<item>').slice(1, maxItems + 1);

    for (const item of itemMatches) {
      const titleMatch = item.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>|<title>([^<]+)<\/title>/);
      const linkMatch = item.match(/<link>([^<]+)<\/link>/);
      const dateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);

      if (titleMatch) {
        items.push({
          title: (titleMatch[1] || titleMatch[2]).trim(),
          url: linkMatch ? linkMatch[1].trim() : url,
          date: dateMatch ? dateMatch[1].trim() : null
        });
      }
    }

    return {
      success: true,
      items,
      itemCount: items.length
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      items: []
    };
  }
}

/**
 * Test and fetch from a web page with JSON data
 */
async function fetchWebJSON(source) {
  const { url, config = {} } = source;
  const maxItems = config.maxItems || 8;

  try {
    const html = execSync(
      `curl -sL "${url}" --max-time 30 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );

    const items = [];

    // Try __NEXT_DATA__ extraction
    const jsonMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        
        // Try common paths for posts
        const posts = 
          jsonData?.props?.pageProps?.hydration?.responses?.[0]?.data?.node?.posts?.nodes ||
          jsonData?.props?.pageProps?.posts ||
          jsonData?.props?.pageProps?.articles ||
          [];

        for (const post of posts.slice(0, maxItems)) {
          if (post.title) {
            items.push({
              title: post.title,
              url: post.permalink || post.url || url,
              author: post.authors?.[0]?.name || post.author || null,
              date: post.publishedAt || post.date || null
            });
          }
        }
      } catch (parseErr) {
        // Fall through to regex extraction
      }
    }

    // Fallback: regex extraction
    if (items.length === 0) {
      const titleRegex = /"title":\s*"([^"]{20,150})"/g;
      let match;
      while ((match = titleRegex.exec(html)) !== null && items.length < maxItems) {
        const title = match[1]
          .replace(/\\u0026/g, '&')
          .replace(/\\u003c/g, '<')
          .replace(/\\u003e/g, '>')
          .replace(/\\/g, '');

        if (!items.some(i => i.title === title)) {
          items.push({ title, url });
        }
      }
    }

    return {
      success: items.length > 0,
      items,
      itemCount: items.length,
      error: items.length === 0 ? 'No items found' : null
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      items: []
    };
  }
}

/**
 * Test and fetch from email inbox
 */
async function fetchEmail(source) {
  const { config = {} } = source;
  const agent = config.agent || 'luca';
  const senders = config.senders || [];
  const maxAge = config.maxAge || '24h';

  try {
    const resp = await fetch(`${MIDDLEWARE_API}/email/list/${agent}?top=50`);
    const emails = await resp.json();

    if (emails.error) {
      throw new Error(emails.error.message || emails.error);
    }

    // Filter by senders and age
    const cutoff = new Date(Date.now() - parseAge(maxAge));
    const items = emails
      .filter(e => {
        const receivedDate = new Date(e.receivedDateTime);
        const addr = (e.from?.emailAddress?.address || '').toLowerCase();
        const name = (e.from?.emailAddress?.name || '').toLowerCase();
        
        const matchesSender = senders.length === 0 || 
          senders.some(s => addr.includes(s.toLowerCase()) || name.includes(s.toLowerCase()));
        
        return receivedDate >= cutoff && matchesSender;
      })
      .map(e => ({
        title: e.subject,
        from: e.from?.emailAddress?.name || e.from?.emailAddress?.address,
        date: e.receivedDateTime,
        id: e.id,
        preview: e.bodyPreview
      }));

    return {
      success: true,
      items,
      itemCount: items.length
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      items: []
    };
  }
}

function parseAge(age) {
  const match = age.match(/^(\d+)(h|d|w)$/);
  if (!match) return 24 * 60 * 60 * 1000; // default 24h

  const [, num, unit] = match;
  const multipliers = { h: 3600000, d: 86400000, w: 604800000 };
  return parseInt(num) * multipliers[unit];
}

/**
 * Test a source and return results
 */
async function testSource(source) {
  const startTime = Date.now();
  let result;

  switch (source.type) {
    case 'rss':
      result = await fetchRSS(source);
      break;
    case 'web-json':
      result = await fetchWebJSON(source);
      break;
    case 'email':
      result = await fetchEmail(source);
      break;
    default:
      result = { success: false, error: `Unknown source type: ${source.type}`, items: [] };
  }

  return {
    ...result,
    responseTime: Date.now() - startTime,
    sampleItems: result.items.slice(0, 3)
  };
}

/**
 * Detect source type from URL
 */
async function detectSourceType(url) {
  // Try RSS first
  try {
    const rssResult = await fetchRSS({ url, config: { maxItems: 3 } });
    if (rssResult.success && rssResult.itemCount > 0) {
      return { type: 'rss', ...rssResult };
    }
  } catch (e) {}

  // Try web-json
  try {
    const webResult = await fetchWebJSON({ url, config: { maxItems: 3 } });
    if (webResult.success && webResult.itemCount > 0) {
      return { type: 'web-json', ...webResult };
    }
  } catch (e) {}

  return { type: 'unknown', success: false, error: 'Could not detect source type' };
}

module.exports = {
  fetchRSS,
  fetchWebJSON,
  fetchEmail,
  testSource,
  detectSourceType
};
