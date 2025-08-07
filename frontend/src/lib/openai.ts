import OpenAI from 'openai';
import { AIAnalysis } from '@/types';

// OpenAI Configuration
export function getOpenAIKey(): string {
  // Try to get from localStorage first (user input)
  const storedKey = localStorage.getItem('openai_api_key');
  if (storedKey) {
    return storedKey;
  }
  
  // Try environment variable
  const envKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (envKey) {
    return envKey;
  }
  
  // No key available - user must provide one
  throw new Error('OpenAI API key is required. Please set your API key in the application settings or set VITE_OPENAI_API_KEY environment variable.');
}

function createOpenAIClient() {
  const apiKey = getOpenAIKey();
  return new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Note: In production, this should be done server-side
  });
}

// Function to truncate text to stay within token limits
function truncateText(text: string, maxChars: number = 3000): string {
  if (text.length <= maxChars) {
    return text;
  }
  
  // Try to truncate at a sentence boundary
  const truncated = text.substring(0, maxChars);
  const lastSentence = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  
  const cutPoint = Math.max(lastSentence, lastNewline);
  if (cutPoint > maxChars * 0.8) {
    return truncated.substring(0, cutPoint + 1);
  }
  
  return truncated + '...';
}

// Robust JSON parsing for OpenAI responses
function parseOpenAIResponse(text: string): AIAnalysis {
  // Clean the text first
  const cleanText = text.trim();
  
  // Try multiple JSON extraction strategies
  const jsonExtractionStrategies = [
    // Strategy 1: Find complete JSON object
    () => {
      const match = cleanText.match(/\{[\s\S]*\}/);
      return match ? match[0] : null;
    },
    
    // Strategy 2: Find JSON between code blocks
    () => {
      const match = cleanText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      return match ? match[1] : null;
    },
    
    // Strategy 3: Extract from first { to last }
    () => {
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return cleanText.substring(firstBrace, lastBrace + 1);
      }
      return null;
    }
  ];
  
  let jsonString: string | null = null;
  
  // Try each extraction strategy
  for (const strategy of jsonExtractionStrategies) {
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
  
  // Try parsing with multiple cleanup attempts
  const parseAttempts = [
    // Attempt 1: Parse as-is
    () => JSON.parse(jsonString!),
    
    // Attempt 2: Fix common JSON issues
    () => {
      let fixed = jsonString!
        .replace(/,\s*}/g, '}')  // Remove trailing commas
        .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
        .replace(/:\s*'([^']*)'/g, ': "$1"'); // Convert single quotes to double
      return JSON.parse(fixed);
    },
    
    // Attempt 3: Remove comments and try again
    () => {
      let fixed = jsonString!
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/\/\/.*$/gm, '') // Remove line comments
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      return JSON.parse(fixed);
    }
  ];
  
  let parsedData: any = null;
  let lastError: Error | null = null;
  
  // Try each parsing attempt
  for (const attempt of parseAttempts) {
    try {
      parsedData = attempt();
      if (parsedData) break;
    } catch (e) {
      lastError = e as Error;
      continue;
    }
  }
  
  if (!parsedData) {
    console.error('Failed to parse JSON:', jsonString);
    throw new Error(`Invalid JSON response from OpenAI: ${lastError?.message || 'Unknown parsing error'}`);
  }
  
  // Validate the parsed data structure
  return validateAIAnalysis(parsedData);
}

// Validate and sanitize AI analysis data
function validateAIAnalysis(data: any): AIAnalysis {
  // Provide defaults for missing fields
  const analysis: AIAnalysis = {
    document_type: data.document_type || 'other',
    confidence: typeof data.confidence === 'number' ? Math.max(0, Math.min(1, data.confidence)) : 0.5,
    suggested_form: data.suggested_form || 'personal_information',
    extracted_data: data.extracted_data || {}
  };
  
  // Ensure extracted_data is an object with string values
  if (typeof analysis.extracted_data !== 'object' || analysis.extracted_data === null) {
    analysis.extracted_data = {};
  }
  
  // Clean extracted data - ensure all values are strings
  const cleanedData: Record<string, any> = {};
  Object.entries(analysis.extracted_data).forEach(([key, value]) => {
    if (key && value !== null && value !== undefined) {
      cleanedData[key] = String(value).trim();
    }
  });
  analysis.extracted_data = cleanedData;
  
  return analysis;
}

// Retry mechanism for API calls
async function retryOpenAICall<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on authentication errors
      if (lastError.message.includes('401') || lastError.message.includes('Invalid API key')) {
        throw lastError;
      }
      
      // Wait before retrying (exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  throw lastError!;
}

export async function analyzeDocument(text: string): Promise<AIAnalysis> {
  // Validate API key exists
  const apiKey = getOpenAIKey();
  if (!apiKey || apiKey.length < 10) {
    throw new Error('OpenAI API key is required. Please set your API key in the application settings.');
  }

  try {
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

    const openai = createOpenAIClient();
    
    const response = await retryOpenAICall(async () => {
      return await openai.chat.completions.create({
        model: 'gpt-3.5-turbo', // Changed from gpt-4 to avoid rate limits
        messages: [
          {
            role: 'system',
            content: 'You are an expert document analyzer. Extract information accurately and respond with ONLY valid JSON. No explanations, no markdown, no code blocks. Just pure, parseable JSON with proper syntax.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000 // Reduced token usage
      });
    });

    const result = response.choices[0].message.content;
    if (!result) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response with robust error handling
    return parseOpenAIResponse(result);
  } catch (error) {
    console.error('Error analyzing document with OpenAI:', error);
    
    // Check if it's a rate limit error
    if (error instanceof Error && error.message.includes('429')) {
      throw new Error('OpenAI API rate limit exceeded. Please wait a moment and try again.');
    }
    
    // Check if it's an API key error
    if (error instanceof Error && error.message.includes('401')) {
      throw new Error('Invalid OpenAI API key. Please check your API key configuration.');
    }
    
    // For other errors, throw them instead of falling back to mock data
    throw new Error(`Failed to analyze document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Extract text from image using OpenAI Vision API
export async function extractTextFromImage(imageBase64: string): Promise<string> {
  // Validate API key exists
  const apiKey = getOpenAIKey();
  if (!apiKey || apiKey.length < 10) {
    throw new Error('OpenAI API key is required. Please set your API key in the application settings.');
  }

  try {
    const prompt = `
Extract ALL text from this image. Return ONLY the extracted text, no explanations or formatting.
If there is no readable text in the image, return "No text found".
Focus on getting every word, number, and character visible in the image.
`;

    const openai = createOpenAIClient();
    
    const response = await retryOpenAICall(async () => {
      return await openai.chat.completions.create({
        model: 'gpt-4o', // Use gpt-4o for vision capabilities
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
    });

    const result = response.choices[0].message.content;
    if (!result) {
      throw new Error('No response from OpenAI Vision API');
    }

    // Clean up the response - remove any markdown or formatting
    const cleanText = result.trim()
      .replace(/^```[\w]*\n?/, '') // Remove opening code blocks
      .replace(/\n?```$/, '')     // Remove closing code blocks
      .replace(/^\*\*.*?\*\*/g, '') // Remove bold markdown
      .trim();

    if (cleanText.toLowerCase().includes('no text found') || cleanText.length === 0) {
      throw new Error('No readable text found in the image');
    }

    return cleanText;
  } catch (error) {
    console.error('Error extracting text from image:', error);
    
    // Check if it's a rate limit error
    if (error instanceof Error && error.message.includes('429')) {
      throw new Error('OpenAI API rate limit exceeded. Please wait a moment and try again.');
    }
    
    // Check if it's an API key error
    if (error instanceof Error && error.message.includes('401')) {
      throw new Error('Invalid OpenAI API key. Please check your API key configuration.');
    }
    
    // For other errors, throw them as OCR-specific errors
    throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Fallback mock analysis for demo purposes
function getMockAnalysis(text: string): AIAnalysis {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('passport')) {
    return {
      document_type: 'passport',
      confidence: 0.95,
      suggested_form: 'visa_application',
      extracted_data: {
        full_name: 'John Michael Smith',
        passport_number: 'P123456789',
        date_of_birth: '1990-05-15',
        nationality: 'United States of America',
        address: '123 Main Street, Apartment 4B, New York, NY 10001',
        phone: '+1 (555) 123-4567',
        email: 'john.smith@email.com',
        purpose_of_visit: 'Business',
        duration_of_stay: '2 weeks'
      }
    };
  } else if (textLower.includes('bank') || textLower.includes('account')) {
    return {
      document_type: 'financial',
      confidence: 0.92,
      suggested_form: 'financial_declaration',
      extracted_data: {
        full_name: 'John Michael Smith',
        account_number: '1234567890',
        bank_name: 'First National Bank',
        balance: '15420.50',
        monthly_income: '8750.00',
        employment_status: 'Employed',
        address: '123 Main Street, Apt 4B, New York, NY 10001'
      }
    };
  } else if (textLower.includes('employment') || textLower.includes('contract')) {
    return {
      document_type: 'personal',
      confidence: 0.88,
      suggested_form: 'personal_information',
      extracted_data: {
        full_name: 'John Michael Smith',
        date_of_birth: '1990-05-15',
        address: '123 Main Street, Apt 4B, New York, NY 10001',
        phone: '+1 (555) 123-4567',
        email: 'john.smith@email.com',
        occupation: 'Senior Software Engineer',
        emergency_contact: 'Sarah Smith (Spouse) - +1 (555) 987-6543'
      }
    };
  } else {
    return {
      document_type: 'other',
      confidence: 0.75,
      suggested_form: 'personal_information',
      extracted_data: {
        full_name: 'John Smith',
        address: '123 Main Street, New York, NY',
        phone: '+1 (555) 123-4567',
        email: 'john.smith@email.com'
      }
    };
  }
}