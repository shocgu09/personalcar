const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { OPENAI_API_KEY, PEXELS_API_KEY } = context.env;

  if (!OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, 500);
  }
  if (!PEXELS_API_KEY) {
    return json({ error: 'PEXELS_API_KEY가 설정되지 않았습니다.' }, 500);
  }

  let image;
  try {
    ({ image } = await context.request.json());
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  }

  try {
    /* ── Step 1: gpt-4.1-mini Responses API로 사람 분석 ── */
    const visionRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: '당신은 사람의 외모와 분위기를 분석해서 퍼스널 맞춤 차량을 추천하는 전문가입니다. 반드시 JSON으로만 응답합니다.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_image',
                image_url: image,
              },
              {
                type: 'input_text',
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
  "pexelsQuery": "Pexels 이미지 검색용 영문 키워드 (예: BMW 3 Series sedan)"
}`,
              },
            ],
          },
        ],
        text: {
          format: { type: 'json_object' },
        },
        temperature: 1,
        max_output_tokens: 2048,
        top_p: 1,
        store: true,
      }),
    });

    const visionData = await visionRes.json();
    if (!visionRes.ok) {
      throw new Error(visionData.error?.message || 'Vision API 오류');
    }

    // Responses API 출력 파싱
    const outputText = visionData.output
      ?.find(o => o.type === 'message')
      ?.content?.find(c => c.type === 'output_text')
      ?.text;

    if (!outputText) throw new Error('응답 파싱 실패: ' + JSON.stringify(visionData));

    const rec = JSON.parse(outputText);

    /* ── Step 2: Pexels에서 차량 이미지 검색 ── */
    const query = rec.pexelsQuery || rec.carName;
    const pexelsRes = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      {
        headers: { Authorization: PEXELS_API_KEY },
      }
    );

    const pexelsData = await pexelsRes.json();
    if (!pexelsRes.ok) {
      throw new Error(pexelsData.error || 'Pexels API 오류');
    }

    // 첫 번째 사진 사용, 없으면 폴백
    const carImageUrl =
      pexelsData.photos?.[0]?.src?.large2x ||
      pexelsData.photos?.[0]?.src?.large ||
      pexelsData.photos?.[0]?.src?.original ||
      `https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=800`;

    return json({ ...rec, carImageUrl });
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
