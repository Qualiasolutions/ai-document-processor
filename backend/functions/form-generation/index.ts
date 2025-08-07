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
        const { documentId, formType = 'auto', customTemplate = null } = await req.json();

        console.log('Form generation request received for documentId:', documentId);

        if (!documentId) {
            throw new Error('Document ID is required');
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

        // Fetch document with AI analysis data
        console.log('Fetching document data...');
        const documentResponse = await fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${documentId}`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!documentResponse.ok) {
            throw new Error('Failed to fetch document data');
        }

        const documents = await documentResponse.json();
        if (documents.length === 0) {
            throw new Error('No document found with this ID');
        }

        const document = documents[0];
        const aiAnalysis = document.ai_analysis;
        const extractedText = document.content || document.extracted_content || '';
        
        // Convert ai_analysis to the expected structure
        const structured_data = {
            document_type: aiAnalysis?.document_type || 'unknown',
            confidence_score: aiAnalysis?.confidence_score || aiAnalysis?.confidence || 0.7,
            extracted_fields: aiAnalysis?.extracted_fields || aiAnalysis?.extracted_data || {}
        };

        console.log('Document data found:', {
            hasText: !!extractedText,
            hasStructuredData: !!structured_data,
            hasAiAnalysis: !!aiAnalysis,
            extractedFieldsCount: Object.keys(structured_data?.extracted_fields || {}).length
        });

        let formTemplate;
        let populatedData = {};

        if (customTemplate) {
            // Use custom template if provided
            formTemplate = customTemplate;
        } else {
            // Generate form template - try AI first, then fallback
            if (openaiApiKey && openaiApiKey.length > 50) {
                try {
                    console.log('Generating form with AI...');
                    const formGenerationPrompt = `Based on the following extracted document data, create a comprehensive form template that would capture all the relevant information.\n\nExtracted Text:\n${extractedText}\n\nStructured Data:\n${JSON.stringify(structured_data, null, 2)}\n\nGenerate a form template as JSON with this structure:\n{\n  \"form_title\": \"string\",\n  \"form_description\": \"string\",\n  \"sections\": [\n    {\n      \"section_title\": \"string\",\n      \"fields\": [\n        {\n          \"field_id\": \"string\",\n          \"field_name\": \"string\",\n          \"field_type\": \"text|email|number|date|textarea|select|checkbox|radio\",\n          \"required\": boolean,\n          \"placeholder\": \"string\",\n          \"options\": [\"array for select/radio fields\"],\n          \"validation\": {\n            \"pattern\": \"regex pattern if needed\",\n            \"min_length\": number,\n            \"max_length\": number\n          }\n        }\n      ]\n    }\n  ]\n}\n\nFocus on creating fields that are most relevant to the document type and content.`;

                    const formResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${openaiApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'gpt-4o',
                            messages: [{
                                role: 'system',
                                content: 'You are an expert form designer. Create comprehensive, well-structured forms based on document content. Always return valid JSON.'
                            }, {
                                role: 'user',
                                content: formGenerationPrompt
                            }],
                            max_tokens: 3000
                        })
                    });

                    if (formResponse.ok) {
                        const formResult = await formResponse.json();
                        try {
                            formTemplate = JSON.parse(formResult.choices[0].message.content);
                            console.log('AI form generation successful');
                        } catch (parseError) {
                            console.warn('AI form JSON parse failed, using fallback');
                            formTemplate = createFallbackForm(structured_data, extractedText);
                        }
                    } else {
                        throw new Error('AI form generation API failed');
                    }
                } catch (aiError) {
                    console.warn('AI form generation failed, using rule-based fallback:', aiError.message);
                    formTemplate = createFallbackForm(structured_data, extractedText);
                }
            } else {
                console.log('No OpenAI API key, using rule-based form generation');
                formTemplate = createFallbackForm(structured_data, extractedText);
            }
        }

        // Auto-populate form fields with extracted data
        if (structured_data && structured_data.extracted_fields) {
            console.log('Auto-populating form fields...');
            
            // Map extracted fields to form fields
            for (const section of formTemplate.sections) {
                for (const field of section.fields) {
                    const fieldId = field.field_id;
                    
                    // Try exact match first
                    if (structured_data.extracted_fields[fieldId]) {
                        populatedData[fieldId] = structured_data.extracted_fields[fieldId];
                    } else {
                        // Try fuzzy matching based on field name
                        const fieldNameLower = field.field_name.toLowerCase();
                        for (const [key, value] of Object.entries(structured_data.extracted_fields)) {
                            if (key.toLowerCase().includes(fieldNameLower) || 
                                fieldNameLower.includes(key.toLowerCase()) ||
                                fieldId.includes(key.toLowerCase()) ||
                                key.toLowerCase().includes(fieldId.toLowerCase())) {
                                populatedData[fieldId] = value;
                                break;
                            }
                        }
                    }
                }
            }
            console.log('Auto-populated fields:', Object.keys(populatedData).length);
        }

        // Generate form name based on document and timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const documentType = structured_data?.document_type || 'Document';
        const formName = `${documentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}_Form_${timestamp}`;

        // Save form to database
        console.log('Saving form to database...');
        const formData = {
            document_id: documentId,
            form_name: formName,
            form_template: formTemplate,
            populated_data: populatedData,
            completion_status: 'draft'
        };

        const saveResponse = await fetch(`${supabaseUrl}/rest/v1/forms`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(formData)
        });

        if (!saveResponse.ok) {
            const errorText = await saveResponse.text();
            console.error('Failed to save form:', errorText);
            throw new Error(`Failed to save form: ${errorText}`);
        }

        const savedForm = await saveResponse.json();
        const formId = savedForm[0].id;
        console.log('Form saved successfully:', formId);

        // Update document status to indicate form has been generated
        await fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${documentId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                processing_step: 4,
                processing_progress: 100,
                updated_at: new Date().toISOString()
            })
        });

        // Create final processing status
        await fetch(`${supabaseUrl}/rest/v1/processing_status`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                document_id: documentId,
                current_step: 'form_generated',
                step_status: 'completed',
                progress_percentage: 100,
                status_message: 'Form generated and auto-populated successfully'
            })
        });

        console.log('Form generation workflow completed');

        return new Response(JSON.stringify({
            data: {
                formId,
                formName,
                formTemplate,
                populatedData,
                documentId,
                completionStatus: 'draft',
                fieldsPopulated: Object.keys(populatedData).length,
                message: openaiApiKey ? 'Form generated with AI assistance' : 'Form generated with rule-based template (OpenAI API key required for AI-powered form generation)'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Form generation error:', error);

        const errorResponse = {
            error: {
                code: 'FORM_GENERATION_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Create fallback form template based on extracted data
function createFallbackForm(structuredData, extractedText) {
    const extractedFields = structuredData?.extracted_fields || {};
    const documentType = structuredData?.document_type || 'general_document';
    
    // Base form structure
    const form = {
        form_title: `${documentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Information Form`,
        form_description: 'Please review and complete the information extracted from your document.',
        sections: []
    };
    
    // Personal Information Section
    const personalFields = [];
    if (extractedFields.name) {
        personalFields.push({
            field_id: 'name',
            field_name: 'Full Name',
            field_type: 'text',
            required: true,
            placeholder: 'Enter full name'
        });
    }
    
    if (extractedFields.email) {
        personalFields.push({
            field_id: 'email',
            field_name: 'Email Address',
            field_type: 'email',
            required: true,
            placeholder: 'Enter email address',
            validation: {
                pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
            }
        });
    }
    
    if (extractedFields.phone) {
        personalFields.push({
            field_id: 'phone',
            field_name: 'Phone Number',
            field_type: 'text',
            required: false,
            placeholder: 'Enter phone number'
        });
    }
    
    if (extractedFields.address) {
        personalFields.push({
            field_id: 'address',
            field_name: 'Address',
            field_type: 'textarea',
            required: false,
            placeholder: 'Enter full address'
        });
    }
    
    if (personalFields.length > 0) {
        form.sections.push({
            section_title: 'Personal Information',
            fields: personalFields
        });
    }
    
    // Business Information Section
    const businessFields = [];
    if (extractedFields.company) {
        businessFields.push({
            field_id: 'company',
            field_name: 'Company Name',
            field_type: 'text',
            required: false,
            placeholder: 'Enter company name'
        });
    }
    
    if (extractedFields.position) {
        businessFields.push({
            field_id: 'position',
            field_name: 'Position/Title',
            field_type: 'text',
            required: false,
            placeholder: 'Enter job title or position'
        });
    }
    
    if (businessFields.length > 0) {
        form.sections.push({
            section_title: 'Business Information',
            fields: businessFields
        });
    }
    
    // Document Details Section
    const documentFields = [];
    
    if (extractedFields.date) {
        documentFields.push({
            field_id: 'date',
            field_name: 'Date',
            field_type: 'date',
            required: false,
            placeholder: 'Select date'
        });
    }
    
    // Add any other extracted fields
    Object.keys(extractedFields).forEach(key => {
        if (!['name', 'email', 'phone', 'address', 'company', 'position', 'date'].includes(key)) {
            documentFields.push({
                field_id: key,
                field_name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                field_type: 'text',
                required: false,
                placeholder: `Enter ${key.replace(/_/g, ' ')}`
            });
        }
    });
    
    // Always add a notes/comments field
    documentFields.push({
        field_id: 'notes',
        field_name: 'Additional Notes',
        field_type: 'textarea',
        required: false,
        placeholder: 'Add any additional information or comments'
    });
    
    if (documentFields.length > 0) {
        form.sections.push({
            section_title: 'Document Details',
            fields: documentFields
        });
    }
    
    // If no sections were created, add a basic section
    if (form.sections.length === 0) {
        form.sections.push({
            section_title: 'General Information',
            fields: [
                {
                    field_id: 'title',
                    field_name: 'Title',
                    field_type: 'text',
                    required: false,
                    placeholder: 'Enter title'
                },
                {
                    field_id: 'description',
                    field_name: 'Description',
                    field_type: 'textarea',
                    required: false,
                    placeholder: 'Enter description'
                }
            ]
        });
    }
    
    return form;
}