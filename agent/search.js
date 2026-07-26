const MIN_INTERVAL_MS = 1100; // Brave free tier allows 1 request/second
let lastRequestAt = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function braveFetch(url, apiKey) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey
    },
    signal: AbortSignal.timeout(10_000)
  });
  return response;
}

export async function searchWeb(query, count = 8) {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'BRAVE_API_KEY not set. Get a free key at https://api.search.brave.com/app/keys (2000 free queries/month)'
    );
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(count));
  url.searchParams.set('safesearch', 'moderate');

  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - sinceLast);

  let response;
  for (let attempt = 0; ; attempt++) {
    lastRequestAt = Date.now();
    response = await braveFetch(url.toString(), apiKey);
    if (response.status !== 429 || attempt >= 2) break;
    await sleep(2000 * (attempt + 1));
  }

  if (response.status === 429) {
    throw new Error('Brave Search rate limit hit repeatedly. Wait a moment before retrying.');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brave Search error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return (data.web?.results || []).map(r => ({
    title: (r.title || '').slice(0, 150),
    url: r.url || '',
    // Trim descriptions so 50 iterations of results don't blow up the context window
    description: (r.description || '').replace(/<[^>]+>/g, '').slice(0, 250),
    age: r.age || null
  }));
}
