// OpenRouter-backed embedding provider for demoRobot flow retrieval.
// Interface is abstract on purpose (design.md Decision 11): decouples
// findRelevantFlows from the concrete embedding model, which is configured
// via settings, not hardcoded here.

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>
}

const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings'
const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small'

export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_EMBEDDING_MODEL,
  ) {}

  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY missing — cannot compute embedding')
    }

    const res = await fetch(OPENROUTER_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://echatbot.ai',
        'X-Title': 'DemoRobot',
      },
      body: JSON.stringify({ model: this.model, input: text }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`OpenRouter embeddings HTTP ${res.status}: ${body.slice(0, 500)}`)
    }

    const data = (await res.json()) as { data?: Array<{ embedding: number[] }> }
    const embedding = data.data?.[0]?.embedding
    if (!embedding) {
      throw new Error('OpenRouter embeddings response missing data[0].embedding')
    }
    return embedding
  }
}
