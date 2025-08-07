Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const { documentId, content } = await req.json();

        if (!documentId || !content) {
            throw new Error('Document ID and content are required');
        }

        // Get environment variables
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

        if (!serviceRoleKey || !supabaseUrl || !openaiApiKey) {
            throw new Error('Configuration missing');
        }

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('Authentication required');
        }

        const token = authHeader.replace('Bearer ', '');
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': serviceRoleKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid authentication token');
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        // Update document status to processing
        await fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${documentId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                processing_status: 'processing',
                updated_at: new Date().toISOString()
            })
        });

        // Truncate content to prevent token limit issues
        const truncatedContent = content.length > 3000 ? content.substring(0, 3000) + '...' : content;

        const prompt = `
Analyze the following document text thoroughly and extract ALL relevant information.

Document text:
${truncatedContent}

IMPORTANT: Respond with ONLY a valid JSON object. No explanations, no markdown, no code blocks. Just pure JSON.

Required JSON structure:
{
  "document_type": "passport" | "visa" | "bank_statement" | "employment" | "financial" | "personal" | "contract" | "invoice" | "resume" | "medical" | "legal" | "other",
  "confidence": 0.85,
  "suggested_form": "visa_application" | "financial_declaration" | "personal_information" | "employment_application" | "medical_intake" | "legal_document" | "contract_review" | "invoice_processing",
  "extracted_data": {
    "full_name": "string",
    "first_name": "string",
    "last_name": "string",
    "date_of_birth": "YYYY-MM-DD",
    "nationality": "string",
    "passport_number": "string",
    "passport_expiry": "YYYY-MM-DD",
    "gender": "string",
    "place_of_birth": "string",
    "account_number": "string",
    "bank_name": "string",
    "account_balance": "string",
    "monthly_income": "string",
    "address": "string",
    "city": "string",
    "state": "string",
    "postal_code": "string",
    "country": "string",
    "phone": "string",
    "email": "string",
    "occupation": "string",
    "company": "string",
    "position": "string",
    "department": "string",
    "employee_id": "string",
    "salary": "string",
    "employment_date": "YYYY-MM-DD",
    "visa_type": "string",
    "visa_number": "string",
    "visa_expiry": "YYYY-MM-DD",
    "issue_date": "YYYY-MM-DD",
    "issuing_authority": "string",
    "purpose_of_visit": "string",
    "duration_of_stay": "string",
    "contract_terms": "string",
    "invoice_number": "string",
    "invoice_amount": "string",
    "due_date": "YYYY-MM-DD",
    "additional_fields": {}
  }
}

Rules:
- Extract EVERY field you can find in the document
- Include only fields that are actually found in the document
- Use empty string "" for missing fields, not null
- Confidence must be between 0 and 1
- All dates in YYYY-MM-DD format
- Put any extra fields not listed above in "additional_fields"
- Be thorough - extract reference numbers, IDs, amounts, dates, etc.
- Match document_type and suggested_form accurately based on content
`;

        // Call OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert document analyzer specializing in extracting structured data. Extract information accurately and respond with ONLY valid JSON. Be thorough and extract every piece of relevant information you can find.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 2000
            })
        });

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.text();
            throw new Error(`OpenAI API error: ${errorData}`);
        }

        const aiResult = await openaiResponse.json();
        const analysisText = aiResult.choices[0].message.content;

        // Parse JSON response
        let analysis;
        try {
            // Clean the response to extract JSON
            const cleanText = analysisText.trim();
            const match = cleanText.match(/\{[\s\S]*\}/);
            const jsonString = match ? match[0] : cleanText;
            analysis = JSON.parse(jsonString);
        } catch (parseError) {
            console.error('JSON parsing error:', parseError);
            throw new Error('Failed to parse AI response');
        }

        // Validate and sanitize analysis
        const validatedAnalysis = {
            document_type: analysis.document_type || 'other',
            confidence: typeof analysis.confidence === 'number' ? Math.max(0, Math.min(1, analysis.confidence)) : 0.5,
            suggested_form: analysis.suggested_form || 'personal_information',
            extracted_data: analysis.extracted_data || {}
        };

        // Update document with AI analysis
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${documentId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ai_analysis: validatedAnalysis,
                document_type: validatedAnalysis.document_type,
                processing_status: 'completed',
                updated_at: new Date().toISOString()
            })
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update document with analysis');
        }

        // Log the action
        await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                action: 'ai_analysis',
                resource_type: 'document',
                resource_id: documentId,
                details: { confidence: validatedAnalysis.confidence, document_type: validatedAnalysis.document_type },
                created_at: new Date().toISOString()
            })
        });

        return new Response(JSON.stringify({
            data: {
                analysis: validatedAnalysis,
                documentId: documentId
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('AI analysis error:', error);

        const errorResponse = {
            error: {
                code: 'AI_ANALYSIS_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});