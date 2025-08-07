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
        const { fileData, fileName, fileType, processImmediately } = await req.json();

        if (!fileData || !fileName) {
            throw new Error('File data and filename are required');
        }

        // Get environment variables
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        console.log('Environment check:', {
            hasServiceRole: !!serviceRoleKey,
            hasSupabaseUrl: !!supabaseUrl,
            hasOpenAI: !!openaiApiKey
        });

        // No authentication required - create anonymous user session
        const userId = null;
        const sessionId = `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('Anonymous session created:', sessionId);

        // Extract base64 data
        const base64Data = fileData.split(',')[1];
        const mimeType = fileData.split(';')[0].split(':')[1];
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        // Generate unique filename for anonymous uploads
        const timestamp = Date.now();
        const uniqueFileName = `anonymous/${timestamp}-${fileName}`;

        // Upload to Supabase Storage
        const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/qualia-documents/${uniqueFileName}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': mimeType,
                'x-upsert': 'true'
            },
            body: binaryData
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload failed: ${errorText}`);
        }

        // Get public URL
        const fileUrl = `${supabaseUrl}/storage/v1/object/public/qualia-documents/${uniqueFileName}`;

        // Process the file immediately if requested and OpenAI key is available
        let extractedText = '';
        let aiAnalysis: any = null;
        let processingStatus = 'uploaded';

        if (processImmediately && openaiApiKey && openaiApiKey.length > 20) {
            try {
                console.log('Starting immediate processing...');
                processingStatus = 'processing';

                // Extract text based on file type
                if (mimeType === 'text/plain') {
                    extractedText = new TextDecoder().decode(binaryData);
                    console.log('Extracted text from plain text file:', extractedText.length, 'characters');
                } else if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
                    // Use OpenAI Vision for OCR
                    console.log('Using OpenAI Vision for OCR...');
                    const ocrResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${openaiApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'gpt-4o',
                            messages: [{
                                role: 'user',
                                content: [{
                                    type: 'text',
                                    text: 'Extract all text content from this document. Provide the complete text exactly as it appears.'
                                }, {
                                    type: 'image_url',
                                    image_url: { url: fileData }
                                }]
                            }],
                            max_tokens: 4000
                        })
                    });

                    if (ocrResponse.ok) {
                        const ocrResult = await ocrResponse.json();
                        extractedText = ocrResult.choices[0].message.content;
                        console.log('OCR completed, extracted:', extractedText.length, 'characters');
                    } else {
                        const errorText = await ocrResponse.text();
                        console.error('OCR API failed:', ocrResponse.status, errorText);
                        processingStatus = 'failed';
                    }
                }

                // If we have text, do AI analysis
                if (extractedText && extractedText.trim().length > 0) {
                    console.log('Starting AI analysis...');
                    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${openaiApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'gpt-4o',
                            messages: [{
                                role: 'system',
                                content: 'You are an expert document analyzer. Extract structured data from documents and return ONLY valid JSON. Be thorough and extract every relevant field.'
                            }, {
                                role: 'user',
                                content: `You are an expert data extraction specialist. Analyze this document thoroughly and extract ALL personal and relevant information. Be aggressive in finding data - look for names, dates, numbers, addresses, and any identifying information.

CRITICAL: Return ONLY valid JSON, no explanations or markdown. Structure:

{
  "document_type": "passport|visa|bank_statement|employment|financial|personal|legal|contract|medical|invoice|resume|other",
  "extracted_fields": {
    "full_name": "Extract complete name if found",
    "first_name": "Extract first name if found", 
    "middle_name": "Extract middle name if found",
    "last_name": "Extract surname/family name if found",
    "date_of_birth": "YYYY-MM-DD format if found",
    "place_of_birth": "Birth location if found",
    "nationality": "Country of citizenship if found",
    "gender": "Male/Female if mentioned",
    "passport_number": "Passport ID if found",
    "passport_expiry": "YYYY-MM-DD if found",
    "passport_issue": "YYYY-MM-DD if found",
    "id_number": "Any ID number found",
    "social_security": "SSN or equivalent if found",
    "address": "Full address if found",
    "city": "City name if found",
    "state": "State/province if found",
    "postal_code": "ZIP/postal code if found",
    "country": "Country if found",
    "phone": "Phone number if found",
    "mobile": "Mobile number if found",
    "email": "Email address if found",
    "company": "Company/employer name if found",
    "position": "Job title if found",
    "department": "Department if found",
    "employee_id": "Employee ID if found",
    "salary": "Salary amount if found",
    "employment_date": "YYYY-MM-DD if found",
    "bank_name": "Bank name if found",
    "account_number": "Account number if found",
    "account_balance": "Balance amount if found",
    "routing_number": "Routing number if found",
    "visa_type": "Visa category if found",
    "visa_number": "Visa number if found",
    "visa_expiry": "YYYY-MM-DD if found",
    "marital_status": "Marital status if found",
    "occupation": "Profession if found",
    "additional_fields": {}
  },
  "confidence_score": 0.0-1.0,
  "suggested_form": "visa_application|financial_declaration|personal_information|employment_application|medical_intake"
}

EXTRACTION RULES:
1. Extract ANY name-like text as names (even if not explicitly labeled)
2. Look for dates in any format and standardize to YYYY-MM-DD
3. Find ANY numbers that could be IDs, accounts, or reference numbers
4. Extract addresses even if partial
5. Look for email patterns and phone patterns
6. Put any other valuable data in additional_fields
7. If unsure about a field, include it anyway with lower confidence
8. NEVER leave extracted_fields empty - always find something

Document content:
${extractedText.substring(0, 6000)}`
                            }],
                            max_tokens: 2000
                        })
                    });

                    if (analysisResponse.ok) {
                        const analysisResult = await analysisResponse.json();
                        try {
                            let aiContent = analysisResult.choices[0].message.content;
                            console.log('Raw AI response:', aiContent);
                            
                            // Clean up markdown code blocks if present
                            if (aiContent.includes('```json')) {
                                aiContent = aiContent.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
                                console.log('Cleaned AI response:', aiContent);
                            }
                            
                            aiAnalysis = JSON.parse(aiContent);
                            processingStatus = 'completed';
                            console.log('AI analysis completed successfully:', Object.keys(aiAnalysis));
                        } catch (parseError) {
                            console.warn('Failed to parse AI response as JSON:', parseError);
                            let rawContent = analysisResult.choices[0].message.content;
                            
                            // Try one more cleanup attempt
                            if (rawContent.includes('```json')) {
                                rawContent = rawContent.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
                                try {
                                    aiAnalysis = JSON.parse(rawContent);
                                    processingStatus = 'completed';
                                    console.log('AI analysis completed after cleanup');
                                } catch (retryError) {
                                    aiAnalysis = {
                                        document_type: 'unknown',
                                        raw_analysis: analysisResult.choices[0].message.content,
                                        confidence_score: 0.5
                                    };
                                    processingStatus = 'completed';
                                }
                            } else {
                                aiAnalysis = {
                                    document_type: 'unknown',
                                    raw_analysis: analysisResult.choices[0].message.content,
                                    confidence_score: 0.5
                                };
                                processingStatus = 'completed';
                            }
                        }
                    } else {
                        const errorText = await analysisResponse.text();
                        console.error('Analysis API failed:', analysisResponse.status, errorText);
                        processingStatus = 'failed';
                    }
                } else {
                    console.warn('No extracted text available for AI analysis');
                    processingStatus = 'completed';
                }
            } catch (processingError) {
                console.error('Processing error:', processingError);
                processingStatus = 'failed';
            }
        } else {
            console.log('Skipping AI processing - no OpenAI API key or immediate processing not requested');
            processingStatus = 'uploaded';
        }

        // Save document metadata to database
        const documentData = {
            user_id: userId,
            filename: fileName,
            file_url: fileUrl,
            file_size: binaryData.length,
            file_type: mimeType,
            content: extractedText || `File: ${fileName}`,
            status: 'uploaded',
            processing_status: processingStatus,
            extracted_content: extractedText ? extractedText.substring(0, 1000) : null,
            ai_analysis: aiAnalysis,
            metadata: {
                session_id: sessionId,
                public_url: fileUrl,
                upload_timestamp: timestamp,
                processed_immediately: processImmediately
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/documents`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(documentData)
        });

        if (!insertResponse.ok) {
            const errorText = await insertResponse.text();
            throw new Error(`Database insert failed: ${errorText}`);
        }

        const document = await insertResponse.json();

        // Generate a form if we have AI analysis
        let generatedForm = null;
        if (aiAnalysis && aiAnalysis.extracted_fields) {
            try {
                const formData = {
                    user_id: userId,
                    document_id: document[0].id,
                    form_type: aiAnalysis.document_type || 'general',
                    title: `Form for ${fileName}`,
                    form_data: {
                        template: aiAnalysis.document_type || 'personal_information',
                        fields: aiAnalysis.extracted_fields
                    },
                    populated_data: aiAnalysis.extracted_fields,
                    completion_status: 'ready',
                    status: 'generated'
                };

                const formResponse = await fetch(`${supabaseUrl}/rest/v1/generated_forms`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(formData)
                });

                if (formResponse.ok) {
                    generatedForm = await formResponse.json();
                    console.log('Form generated successfully');
                }
            } catch (formError) {
                console.warn('Failed to generate form:', formError);
            }
        }

        return new Response(JSON.stringify({
            data: {
                document: document[0],
                fileUrl: fileUrl,
                extractedText: extractedText ? extractedText.substring(0, 200) : null,
                aiAnalysis: aiAnalysis,
                generatedForm: generatedForm ? generatedForm[0] : null,
                processingStatus: processingStatus
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Document upload/process error:', error);

        const errorResponse = {
            error: {
                code: 'DOCUMENT_UPLOAD_PROCESS_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});