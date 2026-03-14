import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RenderRequest = {
  provider?: "gemini" | "openAI" | "openai";
  image: string;
  style: string;
  styleDescription?: string;
  roomType?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RenderRequest;

    if (!body?.image || !body?.style) {
      return NextResponse.json({ error: "Missing image or style" }, { status: 400 });
    }

    const provider = (body.provider || "gemini").toLowerCase();
    if (provider === "openai") {
      return await handleOpenAI(body);
    }
    return await handleGemini(body);
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function handleGemini(body: RenderRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const prompt = buildPrompt(body);
  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: body.image
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      topK: 32,
      topP: 1,
      maxOutputTokens: 1024,
      responseModalities: ["IMAGE", "TEXT"]
    }
  };

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "Gemini API error", detail: text }, { status: res.status });
  }

  const data = await res.json();
  const inlineData = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData || p.inline_data)?.inlineData ||
    data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData || p.inline_data)?.inline_data;

  const imageBase64 = inlineData?.data;
  if (!imageBase64) {
    return NextResponse.json({ error: "No image in Gemini response" }, { status: 502 });
  }

  return NextResponse.json({ imageBase64 });
}

async function handleOpenAI(body: RenderRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  const prompt = buildPrompt(body);

  const requestBody = {
    model: "gpt-image-1",
    prompt,
    image: body.image,
    size: "1024x1024",
    response_format: "b64_json"
  };

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "OpenAI API error", detail: text }, { status: res.status });
  }

  const data = await res.json();
  const imageBase64 = data?.data?.[0]?.b64_json;
  if (!imageBase64) {
    return NextResponse.json({ error: "No image in OpenAI response" }, { status: 502 });
  }

  return NextResponse.json({ imageBase64 });
}

function buildPrompt(body: RenderRequest) {
  const styleLine = body.styleDescription ? body.styleDescription : "";
  const roomTypeName = body.roomType ? body.roomType : "Room";
  const roomTypePrompt = resolveRoomTypePrompt(body.roomType);
  const stagerStylePrompt = resolveStagerStylePrompt_app_stager(body.style);

  return [
    "You are an architectural visualization AI.",
    "",
    "Transform the uploaded image of an empty interior space into a professionally staged interior.",
    "",
    "STRICT CONSTRAINTS",
    "- Preserve the original room geometry",
    "- Preserve camera position",
    "- Preserve perspective and lens characteristics",
    "- Preserve wall positions",
    "- Preserve windows and doors",
    "- Preserve ceiling height",
    "- Preserve floor boundaries",
    "- Do not modify architecture",
    "",
    "The output must look like the same room photographed from the same position, but professionally furnished and styled.",
    "",
    "STAGING RULES",
    "- Add realistic furniture appropriate for the selected design style",
    "- Add lighting fixtures consistent with the style",
    "- Add decorative elements",
    "- Add textiles and materials",
    "- Maintain realistic circulation space",
    "- Maintain correct furniture scale",
    "",
    "LIGHTING",
    "- Natural architectural lighting",
    "- Soft realistic shadows",
    "- Professional interior photography lighting",
    "- Balanced highlights and reflections",
    "",
    "RENDER QUALITY",
    "- Ultra realistic architectural photography",
    "- Natural materials",
    "- High-end interior design look",
    "- Professional magazine quality",
    "- Avoid exaggerated AI artifacts",
    "",
    stagerStylePrompt,
    "",
    styleLine,
    "",
    roomTypePrompt
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function resolveRoomTypePrompt(roomType?: string) {
  if (!roomType) {
    return "";
  }

  switch (roomType.toLowerCase()) {
    case "living room":
      return "Comfortable seating layout with sofa and lounge chairs, coffee table, balanced composition around a focal point, layered lighting, decorative elements, realistic living room proportions.";
    case "bedroom":
      return "Bed positioned logically within the room, bedside tables, soft textiles and bedding, wardrobe or storage elements, calm and balanced bedroom atmosphere.";
    case "bathroom":
      return "Aligned tiles on walls and floors, realistic sink and vanity placement, mirror above vanity, shower or bathtub integrated with walls, plumbing fixtures aligned properly.";
    case "kitchen":
      return "Cabinets aligned with walls, straight countertops, integrated appliances, backsplash tiles following grid alignment, realistic kitchen workflow layout.";
    case "dining room":
      return "Dining table centered in the room with proportional seating, pendant lighting above table, clear circulation space around the table, balanced dining composition.";
    case "home office":
    case "office":
    case "office / study":
      return "Desk positioned near natural light when possible, ergonomic chair, shelving or storage elements, minimal clutter, functional workspace layout.";
    default:
      return "";
  }
}

// STAGER APP STYLE PROMPTS (app_stager namespace)
function resolveStagerStylePrompt_app_stager(styleName?: string): string {
  if (!styleName) return "";

  switch (styleName) {
    case "Modern Minimalist":
      return [
        "Style: Minimalist Interior",
        "",
        "Use:",
        "- extremely reduced furniture",
        "- neutral monochrome palette",
        "- white walls",
        "- natural wood accents",
        "- very clean surfaces",
        "- large empty space",
        "- simple geometric furniture",
        "",
        "Mood: serene, zen-like, uncluttered environment."
      ].join("\n");

    case "Scandinavian":
      return [
        "Style: Scandinavian Design",
        "",
        "Use:",
        "- light wood furniture",
        "- white walls",
        "- soft neutral textiles",
        "- simple modern furniture",
        "- natural materials",
        "- indoor plants",
        "- minimalist decor",
        "",
        "Mood: bright Nordic home with natural warmth."
      ].join("\n");

    case "Industrial Loft":
      return [
        "Style: Milan Contemporary Design",
        "",
        "Use:",
        "- elegant Italian contemporary furniture",
        "- warm neutral tones",
        "- natural stone accents",
        "- smoked glass",
        "- brushed brass details",
        "- sculptural lighting",
        "- sophisticated minimal décor",
        "",
        "Mood: luxury Milan apartment interior."
      ].join("\n");

    case "Luxury Contemporary":
      return [
        "Style: Luxury Contemporary Interior",
        "",
        "Use:",
        "- premium furniture",
        "- marble or stone elements",
        "- sculptural lighting fixtures",
        "- large designer sofas",
        "- sophisticated neutral palette",
        "- elegant art pieces",
        "- high-end materials",
        "",
        "Mood: five-star luxury residence."
      ].join("\n");

    case "Coastal Hamptons":
      return [
        "Style: Hamptons Coastal Interior",
        "",
        "Use:",
        "- white and soft blue palette",
        "- linen sofas",
        "- light oak or white wood furniture",
        "- coastal artwork",
        "- wicker or rattan elements",
        "- soft beach textures",
        "- light airy curtains",
        "",
        "Mood: bright luxury coastal home."
      ].join("\n");

    case "Bohemian":
      return [
        "Style: Bohemian Interior",
        "",
        "Use:",
        "- layered textiles",
        "- colorful rugs",
        "- patterned cushions",
        "- indoor plants",
        "- handmade decorations",
        "- rattan furniture",
        "- warm earthy colors",
        "",
        "Mood: creative, relaxed, artistic living space."
      ].join("\n");

    case "Mid-Century Modern":
      return [
        "Style: Japanese Tokyo Minimal Interior",
        "",
        "Use:",
        "- tatami or wood floors",
        "- low furniture",
        "- shoji screens",
        "- natural wood structure",
        "- neutral earthy palette",
        "- minimal décor",
        "- soft diffused lighting",
        "",
        "Mood: calm Japanese contemporary living space."
      ].join("\n");

    case "Traditional Classic":
      return [
        "Style: Roman Classical Interior",
        "",
        "Use:",
        "- travertine or stone finishes",
        "- classical sculptures",
        "- arches or architectural niches",
        "- elegant antique furniture",
        "- warm Mediterranean tones",
        "- classical artwork",
        "- Roman architectural inspiration",
        "",
        "Mood: refined Roman historic elegance."
      ].join("\n");

    default:
      return "";
  }
}
