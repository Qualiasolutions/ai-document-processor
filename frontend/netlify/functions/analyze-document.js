const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Helper functions
function truncateText(text, maxChars = 3000) {
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

function parseOpenAIResponse(text) {
  const cleanText = text.trim();
  let jsonString = null;
  
  // Try to extract JSON
  const strategies = [
    () => {
      const match = cleanText.match(/\{[\s\S]*\}/);
      return match ? match[0] : null;
    },
    () => {
      const match = cleanText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      return match ? match[1] : null;
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
  
  const parsed = JSON.parse(jsonString);
  
  return {
    document_type: parsed.document_type || 'other',
    confidence: typeof parsed.confidence === 'number' ? 
      Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    suggested_form: parsed.suggested_form || 'personal_information',
    extracted_data: parsed.extracted_data || {}
  };
}

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'OpenAI API key not configured on server' })
    };
  }

  try {
    const { text } = JSON.parse(event.body);
    
    if (!text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Text is required' })
      };
    }

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
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(analysis)
    };
  } catch (error) {
    console.error('Error analyzing document:', error);
    
    if (error?.status === 429) {
      return {
        statusCode: 429,
        body: JSON.stringify({ 
          error: 'OpenAI API rate limit exceeded. Please wait a moment and try again.' 
        })
      };
    }
    
    if (error?.status === 401) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid OpenAI API key' })
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: `Failed to analyze document: ${error?.message || 'Unknown error'}` 
      })
    };
  }
};