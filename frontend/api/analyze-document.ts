import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Initialize OpenAI client with server-side API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface AIAnalysis {
  document_type: string;
  confidence: number;
  suggested_form: string;
  extracted_data: Record<string, any>;
}

// Function to truncate text to stay within token limits
function truncateText(text: string, maxChars: number = 3000): string {
  if (text.length <= maxChars) {
    return text;
  }
  
  const truncated = text.substring(0, maxChars);
  const lastSentence = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  
  const cutPoint = Math.max(lastSentence, lastNewline);
  if (cutPoint > maxChars * 0.8) {
    return truncated.substring(0, cutPoint + 1);
  }
  
  return truncated + '...';
}

// Parse OpenAI response robustly
function parseOpenAIResponse(text: string): AIAnalysis {
  const cleanText = text.trim();
  
  // Try to extract JSON
  let jsonString: string | null = null;
  
  // Try multiple extraction strategies
  const strategies = [
    () => {
      const match = cleanText.match(/\{[\s\S]*\}/);
      return match ? match[0] : null;
    },
    () => {
      const match = cleanText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      return match ? match[1] : null;
    },
    () => {
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return cleanText.substring(firstBrace, lastBrace + 1);
      }
      return null;
    }
  ];
  
  for (const strategy of strategies) {
    try {
      jsonString = strategy();
      if (jsonString) break;
    } catch (e) {
      continue;
    }
  }
  
  if (!jsonString) {
    throw new Error('No JSON found in OpenAI response');
  }
  
  // Try parsing with cleanup attempts
  const parseAttempts = [
    () => JSON.parse(jsonString!),
    () => {
      let fixed = jsonString!
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
        .replace(/:\s*'([^']*)'/g, ': "$1"');
      return JSON.parse(fixed);
    }
  ];
  
  let parsedData: any = null;
  
  for (const attempt of parseAttempts) {
    try {
      parsedData = attempt();
      if (parsedData) break;
    } catch (e) {
      continue;
    }
  }
  
  if (!parsedData) {
    throw new Error('Invalid JSON response from OpenAI');
  }
  
  // Validate and provide defaults
  return {
    document_type: parsedData.document_type || 'other',
    confidence: typeof parsedData.confidence === 'number' ? 
      Math.max(0, Math.min(1, parsedData.confidence)) : 0.5,
    suggested_form: parsedData.suggested_form || 'personal_information',
    extracted_data: parsedData.extracted_data || {}
  };
}

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
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Truncate text to prevent token limit issues
    const truncatedText = truncateText(text, 3000);
    
    const prompt = `
Analyze the following document text and extract relevant information. 

Document text (first 3000 characters):
${truncatedText}

IMPORTANT: Respond with ONLY a valid JSON object. No explanations, no markdown, no code blocks. Just pure JSON.

Required JSON structure:
{
  "document_type": "passport" | "visa" | "financial" | "personal" | "contract" | "other",
  "confidence": 0.85,
  "suggested_form": "visa_application" | "financial_declaration" | "personal_information",
  "extracted_data": {
    "full_name": "string",
    "date_of_birth": "YYYY-MM-DD",
    "nationality": "string",
    "passport_number": "string",
    "account_number": "string",
    "bank_name": "string",
    "balance": "string",
    "monthly_income": "string",
    "address": "string",
    "phone": "string",
    "email": "string",
    "occupation": "string"
  }
}

Rules:
- Include only fields that are found in the document
- Use empty string "" for missing fields, not null
- Confidence must be between 0 and 1
- All dates in YYYY-MM-DD format
- No trailing commas in JSON
- Double quotes only, no single quotes
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert document analyzer. Extract information accurately and respond with ONLY valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 1000
    });

    const result = response.choices[0].message.content;
    if (!result) {
      throw new Error('No response from OpenAI');
    }

    const analysis = parseOpenAIResponse(result);
    
    return res.status(200).json(analysis);
  } catch (error: any) {
    console.error('Error analyzing document:', error);
    
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
      error: `Failed to analyze document: ${error?.message || 'Unknown error'}` 
    });
  }
}