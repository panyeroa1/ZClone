import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type TranslateRequest = {
  text: string;
  source_lang?: string;
  target_lang: string;
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_TRANSLATE_MODEL = process.env.GEMINI_TRANSLATE_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025';

const parseGeminiText = (data: any): string | undefined => {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text === 'string') return text.trim();
  return undefined;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as TranslateRequest | null;

  if (!body?.text || !body?.target_lang) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const text = String(body.text).trim();
  const sourceLang = String(body.source_lang || 'auto');
  const targetLang = String(body.target_lang);

  if (!text) {
    return NextResponse.json({ text: '' });
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json({ text });
  }

  const prompt =
    `Translate the following text ${sourceLang === 'auto' ? '' : `from ${sourceLang} `}` +
    `to ${targetLang}.\n` +
    `Return only the translation with no extra punctuation or quotes.\n\n` +
    `TEXT:\n${text}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_TRANSLATE_MODEL,
  )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topP: 0.9,
          maxOutputTokens: 256,
        },
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ text });
    }

    const data = await res.json();
    const translated = parseGeminiText(data);
    return NextResponse.json({ text: translated || text });
  } catch {
    return NextResponse.json({ text });
  }
}

