/**
 * Source Adapters v2
 * Parse different source types for briefs
 * 
 * Supported types:
 * - rss: RSS/Atom feeds
 * - web-json: Web pages with embedded JSON (Next.js, etc.)
 * - email: Newsletter inbox scanning
 * - calendar: Calendar events from Microsoft
 * - tasks: Tasks from Todoist or Microsoft To Do
 * - podcast: Podcast RSS feeds (with episode info)
 */

const { execSync } = require('child_process');

const MIDDLEWARE_API = process.env.MIDDLEWARE_API || 'http://localhost:3007/api';

// ============== RSS FEEDS ==============

async function fetchRSS(source) {
  const { url, config = {} } = source;
  const maxItems = config.maxItems || 10;

  try {
    const xml = execSync(
      `curl -sL "${url}" --max-time 20 -A "Mozilla/5.0"`,
      { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
    );

    const items = [];
    const itemMatches = xml.split(/<item>|<entry>/i).slice(1, maxItems + 1);

    for (const item of itemMatches) {
      const titleMatch = item.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>|<title>([^<]+)<\/title>/i);
      const linkMatch = item.match(/<link[^>]*>([^<]+)<\/link>|<link[^>]*href="([^"]+)"/i);
      const dateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>|<published>([^<]+)<\/published>/i);
      const descMatch = item.match(/<description><!\[CDATA\[([^\]]+)\]\]><\/description>|<description>([^<]+)<\/description>/i);

      if (titleMatch) {
        items.push({
          title: (titleMatch[1] || titleMatch[2]).trim(),
          url: linkMatch ? (linkMatch[1] || linkMatch[2]).trim() : url,
          date: dateMatch ? (dateMatch[1] || dateMatch[2]).trim() : null,
          description: descMatch ? (descMatch[1] || descMatch[2]).trim().substring(0, 200) : null
        });
      }
    }

    return { success: true, items, itemCount: items.length };
  } catch (err) {
    return { success: false, error: err.message, items: [] };
  }
}

// ============== WEB JSON (Next.js, etc.) ==============

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
    return { success: false, error: err.message, items: [] };
  }
}

// ============== EMAIL NEWSLETTERS ==============

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
        preview: e.bodyPreview?.substring(0, 200)
      }));

    return { success: true, items, itemCount: items.length };
  } catch (err) {
    return { success: false, error: err.message, items: [] };
  }
}

// ============== CALENDAR ==============

async function fetchCalendar(source) {
  const { config = {} } = source;
  const agent = config.agent || 'luca';
  const days = config.days || 1;
  const includeAllDay = config.includeAllDay !== false;

  try {
    const resp = await fetch(`${MIDDLEWARE_API}/calendar/list/${agent}?days=${days}`);
    const events = await resp.json();

    if (events.error) {
      throw new Error(events.error.message || events.error);
    }

    const items = events
      .filter(e => includeAllDay || !e.isAllDay)
      .map(e => ({
        title: e.subject,
        start: e.start?.dateTime,
        end: e.end?.dateTime,
        location: e.location?.displayName,
        isAllDay: e.isAllDay,
        organizer: e.organizer?.emailAddress?.name,
        isOnline: e.isOnlineMeeting,
        joinUrl: e.onlineMeeting?.joinUrl
      }));

    return { success: true, items, itemCount: items.length };
  } catch (err) {
    return { success: false, error: err.message, items: [] };
  }
}

// ============== TASKS (TODOIST) ==============

async function fetchTasks(source) {
  const { config = {} } = source;
  const provider = config.provider || 'todoist';
  const filter = config.filter || 'today | overdue';

  if (provider === 'todoist') {
    return fetchTodoistTasks(config);
  } else if (provider === 'microsoft') {
    return fetchMicrosoftTasks(config);
  }

  return { success: false, error: `Unknown task provider: ${provider}`, items: [] };
}

async function fetchTodoistTasks(config) {
  const scriptPath = process.env.TODOIST_SCRIPT || '/home/lucalicata/clawd/todoist.js';
  
  try {
    const output = execSync(`node "${scriptPath}" list`, { encoding: 'utf8' });
    
    // Parse the output (assumes format: "- [ ] Task name (due: date)")
    const items = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^-\s*\[([ x])\]\s*(.+?)(?:\s*\(due:\s*(.+?)\))?$/);
      if (match) {
        items.push({
          title: match[2].trim(),
          completed: match[1] === 'x',
          due: match[3] || null
        });
      }
    }

    return { success: true, items, itemCount: items.length };
  } catch (err) {
    return { success: false, error: err.message, items: [] };
  }
}

async function fetchMicrosoftTasks(config) {
  const agent = config.agent || 'luca';
  
  try {
    const resp = await fetch(`${MIDDLEWARE_API}/tasks/list/${agent}`);
    const tasks = await resp.json();

    if (tasks.error) {
      throw new Error(tasks.error.message || tasks.error);
    }

    const items = tasks.map(t => ({
      title: t.title,
      completed: t.status === 'completed',
      due: t.dueDateTime?.dateTime,
      importance: t.importance
    }));

    return { success: true, items, itemCount: items.length };
  } catch (err) {
    return { success: false, error: err.message, items: [] };
  }
}

// ============== PODCAST ==============

async function fetchPodcast(source) {
  const { url, config = {} } = source;
  const maxItems = config.maxItems || 3;

  try {
    const xml = execSync(
      `curl -sL "${url}" --max-time 20 -A "Mozilla/5.0"`,
      { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
    );

    const items = [];
    const itemMatches = xml.split(/<item>/i).slice(1, maxItems + 1);

    for (const item of itemMatches) {
      const titleMatch = item.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>|<title>([^<]+)<\/title>/i);
      const linkMatch = item.match(/<link>([^<]+)<\/link>/i);
      const dateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/i);
      const durationMatch = item.match(/<itunes:duration>([^<]+)<\/itunes:duration>/i);
      const descMatch = item.match(/<description><!\[CDATA\[([^\]]+)\]\]><\/description>|<itunes:summary>([^<]+)<\/itunes:summary>/i);
      const audioMatch = item.match(/<enclosure[^>]+url="([^"]+)"/i);

      if (titleMatch) {
        items.push({
          title: (titleMatch[1] || titleMatch[2]).trim(),
          url: linkMatch ? linkMatch[1].trim() : url,
          date: dateMatch ? dateMatch[1].trim() : null,
          duration: durationMatch ? durationMatch[1].trim() : null,
          description: descMatch ? (descMatch[1] || descMatch[2]).trim().substring(0, 200) : null,
          audioUrl: audioMatch ? audioMatch[1] : null
        });
      }
    }

    return { success: true, items, itemCount: items.length };
  } catch (err) {
    return { success: false, error: err.message, items: [] };
  }
}

// ============== WEATHER ==============

async function fetchWeather(source) {
  const { config = {} } = source;
  const location = config.location || 'London';
  const units = config.units || 'metric';

  try {
    const output = execSync(
      `curl -sL "wttr.in/${encodeURIComponent(location)}?format=j1" --max-time 10`,
      { encoding: 'utf8' }
    );

    const data = JSON.parse(output);
    const current = data.current_condition?.[0];
    const forecast = data.weather?.slice(0, 3) || [];

    const items = [{
      title: `${location}: ${current?.weatherDesc?.[0]?.value || 'Unknown'}`,
      temperature: units === 'metric' ? `${current?.temp_C}°C` : `${current?.temp_F}°F`,
      humidity: `${current?.humidity}%`,
      wind: units === 'metric' ? `${current?.windspeedKmph} km/h` : `${current?.windspeedMiles} mph`,
      forecast: forecast.map(d => ({
        date: d.date,
        high: units === 'metric' ? `${d.maxtempC}°C` : `${d.maxtempF}°F`,
        low: units === 'metric' ? `${d.mintempC}°C` : `${d.mintempF}°F`,
        description: d.hourly?.[4]?.weatherDesc?.[0]?.value
      }))
    }];

    return { success: true, items, itemCount: 1 };
  } catch (err) {
    return { success: false, error: err.message, items: [] };
  }
}

// ============== HELPERS ==============

function parseAge(age) {
  const match = age.match(/^(\d+)(h|d|w)$/);
  if (!match) return 24 * 60 * 60 * 1000; // default 24h

  const [, num, unit] = match;
  const multipliers = { h: 3600000, d: 86400000, w: 604800000 };
  return parseInt(num) * multipliers[unit];
}

// ============== MAIN TEST FUNCTION ==============

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
    case 'calendar':
      result = await fetchCalendar(source);
      break;
    case 'tasks':
      result = await fetchTasks(source);
      break;
    case 'podcast':
      result = await fetchPodcast(source);
      break;
    case 'weather':
      result = await fetchWeather(source);
      break;
    default:
      result = { success: false, error: `Unknown source type: ${source.type}`, items: [] };
  }

  return {
    ...result,
    responseTime: Date.now() - startTime,
    sampleItems: result.items?.slice(0, 3) || []
  };
}

// ============== SOURCE TYPE DEFINITIONS ==============

function getSourceTypes() {
  return [
    {
      type: 'rss',
      name: 'RSS Feed',
      description: 'Standard RSS/Atom feeds from blogs, news sites, Substack',
      icon: '📡',
      configSchema: {
        url: { type: 'string', required: true, label: 'Feed URL' },
        maxItems: { type: 'number', default: 10, label: 'Max items' }
      }
    },
    {
      type: 'web-json',
      name: 'Web Page',
      description: 'Extract articles from modern websites (Next.js, etc.)',
      icon: '🌐',
      configSchema: {
        url: { type: 'string', required: true, label: 'Page URL' },
        maxItems: { type: 'number', default: 8, label: 'Max items' }
      }
    },
    {
      type: 'email',
      name: 'Email Newsletters',
      description: 'Scan inbox for newsletters from specific senders',
      icon: '📧',
      configSchema: {
        agent: { type: 'string', default: 'luca', label: 'Middleware agent' },
        senders: { type: 'array', label: 'Sender keywords' },
        maxAge: { type: 'string', default: '24h', label: 'Max age (e.g., 24h, 7d)' }
      }
    },
    {
      type: 'calendar',
      name: 'Calendar Events',
      description: 'Upcoming meetings and events from Microsoft Calendar',
      icon: '📅',
      configSchema: {
        agent: { type: 'string', default: 'luca', label: 'Middleware agent' },
        days: { type: 'number', default: 1, label: 'Days ahead' },
        includeAllDay: { type: 'boolean', default: true, label: 'Include all-day events' }
      }
    },
    {
      type: 'tasks',
      name: 'Tasks',
      description: 'Tasks from Todoist or Microsoft To Do',
      icon: '✅',
      configSchema: {
        provider: { type: 'string', enum: ['todoist', 'microsoft'], default: 'todoist', label: 'Provider' },
        filter: { type: 'string', default: 'today | overdue', label: 'Filter' }
      }
    },
    {
      type: 'podcast',
      name: 'Podcast',
      description: 'Latest episodes from podcast RSS feeds',
      icon: '🎙️',
      configSchema: {
        url: { type: 'string', required: true, label: 'Podcast RSS URL' },
        maxItems: { type: 'number', default: 3, label: 'Max episodes' }
      }
    },
    {
      type: 'weather',
      name: 'Weather',
      description: 'Current weather and forecast',
      icon: '🌤️',
      configSchema: {
        location: { type: 'string', default: 'London', label: 'Location' },
        units: { type: 'string', enum: ['metric', 'imperial'], default: 'metric', label: 'Units' }
      }
    }
  ];
}

async function detectSourceType(url) {
  // Try RSS first
  try {
    const rssResult = await fetchRSS({ url, config: { maxItems: 3 } });
    if (rssResult.success && rssResult.itemCount > 0) {
      // Check if it's a podcast
      const xml = execSync(`curl -sL "${url}" --max-time 10 -A "Mozilla/5.0"`, { encoding: 'utf8' });
      if (xml.includes('<itunes:') || xml.includes('enclosure')) {
        return { type: 'podcast', ...rssResult };
      }
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
  fetchCalendar,
  fetchTasks,
  fetchPodcast,
  fetchWeather,
  testSource,
  detectSourceType,
  getSourceTypes
};
