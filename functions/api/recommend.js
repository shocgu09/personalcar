// CarFit 추천 — Cloudflare Pages Function
//
// 사진 분석(OpenAI)은 dt 사이트의 /api/carfit 이 한다 (2026-10-09).
// 거기서 DT Club 회원인지와 하루 횟수를 확인하므로 이 함수는 회원의 ID 토큰을 그대로 넘기기만 한다.
// 예전엔 여기서 OpenAI 를 직접 불러 로그인 없이 누구나 반복 호출할 수 있었다.
const DT_API = 'https://dt-1js.pages.dev';

export async function onRequestPost(context) {
  const { PEXELS_API_KEY } = context.env;
  const authorization = context.request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return json({ error: 'DT Club 회원 로그인이 필요합니다.' }, 401);
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
    /* ── Step 1: dt 사이트에서 회원 확인 + 사진 분석 ── */
    const recRes = await fetch(`${context.env.DT_API || DT_API}/api/carfit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
      body: JSON.stringify({ image }),
    });
    const rec = await recRes.json().catch(() => ({}));
    // 401·403·429 는 회원에게 그대로 알린다 (로그인 필요 · 회원 아님 · 오늘 한도)
    if (!recRes.ok || rec.error) return json({ error: rec.error || '분석에 실패했습니다.' }, recRes.ok ? 502 : recRes.status);

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
    headers: { 'Content-Type': 'application/json' },
  });
}
