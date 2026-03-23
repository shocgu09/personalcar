const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { OPENAI_API_KEY } = context.env;

  if (!OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, 500);
  }

  let image;
  try {
    ({ image } = await context.request.json());
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  }

  try {
    /* ── Step 1: GPT-4o Vision으로 사람 분석 ── */
    const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        messages: [
          {
            role: 'system',
            content:
              '당신은 사람의 외모와 분위기를 분석해서 퍼스널 맞춤 차량을 추천하는 전문가입니다. 반드시 JSON으로만 응답합니다.',
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: image } },
              {
                type: 'text',
                text: `이 사람의 얼굴형, 인상, 스타일, 분위기를 분석해서 딱 맞는 차량 1종을 추천해주세요.
반드시 아래 JSON 구조로만 응답하세요:
{
  "carName": "차량 이름 영문 (예: BMW 3 Series)",
  "carNameKo": "차량 이름 한글 (예: BMW 3시리즈)",
  "category": "차종 (예: 세단, SUV, 스포츠카, 해치백)",
  "priceRange": "가격대 한글 (예: 3,000만원~5,000만원)",
  "styleKeywords": ["스타일 키워드1", "키워드2", "키워드3"],
  "personality": "이 사람의 분위기·이미지 분석 2~3문장",
  "reason": "이 차량을 추천하는 핵심 이유 2문장",
  "report": "상세 추천 보고서. 외모 분석 → 라이프스타일 유추 → 차량 매칭 근거 → 이 차량의 매력 포인트 순서로 5~6문장",
  "dallePrompt": "DALL-E 3 영문 프롬프트: professional automotive studio photography of [차량명], dramatic lighting, luxury showroom, ultra realistic, 4K"
}`,
              },
            ],
          },
        ],
      }),
    });

    const visionData = await visionRes.json();
    if (!visionRes.ok) {
      throw new Error(visionData.error?.message || 'Vision API 오류');
    }

    const rec = JSON.parse(visionData.choices[0].message.content);

    /* ── Step 2: DALL-E 3으로 차량 이미지 생성 ── */
    const dallePrompt =
      rec.dallePrompt ||
      `Professional studio automotive photography of ${rec.carName}, dramatic lighting, luxury showroom background, ultra realistic, 4K`;

    const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: dallePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      }),
    });

    const dalleData = await dalleRes.json();
    if (!dalleRes.ok) {
      throw new Error(dalleData.error?.message || 'DALL-E API 오류');
    }

    return json({
      ...rec,
      carImageUrl: dalleData.data[0].url,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
