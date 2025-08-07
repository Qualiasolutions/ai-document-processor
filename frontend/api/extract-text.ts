import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Initialize OpenAI client with server-side API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ 
      error: 'OpenAI API key not configured on server' 
    });
  }

  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const prompt = `
Extract ALL text from this image. Return ONLY the extracted text, no explanations or formatting.
If there is no readable text in the image, return "No text found".
Focus on getting every word, number, and character visible in the image.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert OCR system. Extract text from images accurately. Return only the extracted text with no additional formatting or explanations.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    const result = response.choices[0].message.content;
    if (!result) {
      throw new Error('No response from OpenAI Vision API');
    }

    // Clean up the response
    const cleanText = result.trim()
      .replace(/^```[\w]*\n?/, '')
      .replace(/\n?```$/, '')
      .replace(/^\*\*.*?\*\*/g, '')
      .trim();

    if (cleanText.toLowerCase().includes('no text found') || cleanText.length === 0) {
      return res.status(200).json({ 
        text: '',
        error: 'No readable text found in the image' 
      });
    }

    return res.status(200).json({ text: cleanText });
  } catch (error: any) {
    console.error('Error extracting text from image:', error);
    
    // Handle rate limit errors
    if (error?.status === 429 || error?.message?.includes('429')) {
      return res.status(429).json({ 
        error: 'OpenAI API rate limit exceeded. Please wait a moment and try again.' 
      });
    }
    
    // Handle authentication errors
    if (error?.status === 401 || error?.message?.includes('401')) {
      return res.status(401).json({ 
        error: 'Invalid OpenAI API key' 
      });
    }
    
    return res.status(500).json({ 
      error: `Failed to extract text from image: ${error?.message || 'Unknown error'}` 
    });
  }
}