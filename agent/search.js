export async function searchWeb(query, count = 10) {
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

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey
    }
  });

  if (response.status === 429) {
    throw new Error('Brave Search rate limit hit. Wait a moment before retrying.');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brave Search error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return (data.web?.results || []).map(r => ({
    title: r.title || '',
    url: r.url || '',
    description: r.description || '',
    age: r.age || null
  }));
}
