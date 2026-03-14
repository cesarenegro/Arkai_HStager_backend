# ArkaiHStager Backend

Backend API for the ArkaiHStager iOS application - AI-powered interior design staging.

## Features

- AI-powered room staging and rendering
- Support for multiple AI providers (Gemini, Replicate, OpenAI)
- 8 curated design styles
- Fine-tune controls (walls, floors, doors, furniture, fabrics)
- Room type-specific prompts

## Deployment

Deployed on Vercel.

## Environment Variables

Required environment variables:
- `GEMINI_API_KEY` - Google Gemini API key
- `REPLICATE_API_TOKEN` - Replicate API token (optional)
- `OPENAI_API_KEY` - OpenAI API key (optional)

## API Endpoints

### POST /api/render

Renders an interior design from an uploaded image.

**Request Body:**
```json
{
  "provider": "gemini",
  "image": "base64_encoded_image",
  "style": "Modern Minimalist",
  "styleDescription": "walls in white, hardwood flooring",
  "roomType": "living room"
}
```

**Response:**
```json
{
  "imageBase64": "base64_encoded_result_image"
}
```
