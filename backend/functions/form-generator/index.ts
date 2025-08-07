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
        const { documentIds, templateId, formType, customTemplate } = await req.json();

        if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
            throw new Error('Document IDs are required');
        }

        // Get environment variables
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
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

        // Fetch documents with AI analysis
        const documentsResponse = await fetch(`${supabaseUrl}/rest/v1/documents?id=in.(${documentIds.map(id => `"${id}"`).join(',')})`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!documentsResponse.ok) {
            throw new Error('Failed to fetch documents');
        }

        const documents = await documentsResponse.json();

        // Get template if templateId is provided
        let template = null;
        if (templateId) {
            const templateResponse = await fetch(`${supabaseUrl}/rest/v1/form_templates?id=eq.${templateId}`, {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            });

            if (templateResponse.ok) {
                const templates = await templateResponse.json();
                template = templates[0];
            }
        }

        // Use custom template if provided, otherwise use default templates
        if (customTemplate) {
            template = customTemplate;
        } else if (!template) {
            // Default templates based on form type
            const defaultTemplates = {
                visa_application: {
                    name: 'Visa Application Form',
                    fields: [
                        { name: 'full_name', label: 'Full Name', type: 'text', required: true },
                        { name: 'passport_number', label: 'Passport Number', type: 'text', required: true },
                        { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
                        { name: 'nationality', label: 'Nationality', type: 'text', required: true },
                        { name: 'address', label: 'Address', type: 'textarea', required: true },
                        { name: 'phone', label: 'Phone Number', type: 'text', required: false },
                        { name: 'email', label: 'Email', type: 'email', required: false },
                        { name: 'purpose_of_visit', label: 'Purpose of Visit', type: 'text', required: true }
                    ]
                },
                financial_declaration: {
                    name: 'Financial Declaration Form',
                    fields: [
                        { name: 'full_name', label: 'Full Name', type: 'text', required: true },
                        { name: 'account_number', label: 'Account Number', type: 'text', required: true },
                        { name: 'bank_name', label: 'Bank Name', type: 'text', required: true },
                        { name: 'balance', label: 'Account Balance', type: 'number', required: true },
                        { name: 'monthly_income', label: 'Monthly Income', type: 'number', required: false },
                        { name: 'employment_status', label: 'Employment Status', type: 'text', required: false }
                    ]
                },
                personal_information: {
                    name: 'Personal Information Form',
                    fields: [
                        { name: 'full_name', label: 'Full Name', type: 'text', required: true },
                        { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
                        { name: 'email', label: 'Email', type: 'email', required: true },
                        { name: 'phone', label: 'Phone Number', type: 'text', required: true },
                        { name: 'address', label: 'Address', type: 'textarea', required: true },
                        { name: 'emergency_contact', label: 'Emergency Contact', type: 'text', required: false }
                    ]
                },
                employment_application: {
                    name: 'Employment Application Form',
                    fields: [
                        { name: 'full_name', label: 'Full Name', type: 'text', required: true },
                        { name: 'email', label: 'Email', type: 'email', required: true },
                        { name: 'phone', label: 'Phone Number', type: 'text', required: true },
                        { name: 'address', label: 'Address', type: 'textarea', required: true },
                        { name: 'position_applied', label: 'Position Applied For', type: 'text', required: true },
                        { name: 'available_start_date', label: 'Available Start Date', type: 'date', required: true },
                        { name: 'education', label: 'Education Background', type: 'textarea', required: true },
                        { name: 'work_experience', label: 'Work Experience', type: 'textarea', required: true },
                        { name: 'skills', label: 'Skills', type: 'textarea', required: true }
                    ]
                },
                medical_intake: {
                    name: 'Medical Intake Form',
                    fields: [
                        { name: 'full_name', label: 'Patient Name', type: 'text', required: true },
                        { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
                        { name: 'phone', label: 'Phone Number', type: 'text', required: true },
                        { name: 'address', label: 'Address', type: 'textarea', required: true },
                        { name: 'emergency_contact_name', label: 'Emergency Contact Name', type: 'text', required: true },
                        { name: 'emergency_contact_phone', label: 'Emergency Contact Phone', type: 'text', required: true },
                        { name: 'primary_complaint', label: 'Primary Complaint', type: 'textarea', required: true },
                        { name: 'current_medications', label: 'Current Medications', type: 'textarea', required: false },
                        { name: 'allergies', label: 'Allergies', type: 'textarea', required: false }
                    ]
                },
                legal_document: {
                    name: 'Legal Document Form',
                    fields: [
                        { name: 'document_title', label: 'Document Title', type: 'text', required: true },
                        { name: 'document_date', label: 'Document Date', type: 'date', required: true },
                        { name: 'party_1_name', label: 'First Party Name', type: 'text', required: true },
                        { name: 'party_1_address', label: 'First Party Address', type: 'textarea', required: true },
                        { name: 'party_2_name', label: 'Second Party Name', type: 'text', required: false },
                        { name: 'party_2_address', label: 'Second Party Address', type: 'textarea', required: false },
                        { name: 'subject_matter', label: 'Subject Matter', type: 'textarea', required: true },
                        { name: 'terms_conditions', label: 'Terms and Conditions', type: 'textarea', required: true }
                    ]
                }
            };
            template = defaultTemplates[formType] || defaultTemplates.personal_information;
        }

        // Combine extracted data from all documents
        const combinedData = {};
        documents.forEach(doc => {
            if (doc.ai_analysis && doc.ai_analysis.extracted_data) {
                Object.entries(doc.ai_analysis.extracted_data).forEach(([key, value]) => {
                    if (value && typeof value === 'string' && value.trim() !== '') {
                        combinedData[key] = value;
                    }
                });
            }
        });

        // Map to form fields
        const formData = {};
        if (template.fields) {
            template.fields.forEach(field => {
                if (field && field.name) {
                    formData[field.name] = combinedData[field.name] || '';
                }
            });
        }

        // Generate a title for the form
        const title = `${template.name} - ${new Date().toLocaleDateString()}`;

        // Save generated form to database
        const formRecord = {
            user_id: userId,
            document_ids: documentIds,
            template_id: templateId || null,
            form_data: formData,
            form_type: formType,
            title: title,
            status: 'draft',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/generated_forms`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(formRecord)
        });

        if (!insertResponse.ok) {
            const errorText = await insertResponse.text();
            throw new Error(`Failed to save form: ${errorText}`);
        }

        const savedForm = await insertResponse.json();

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
                action: 'form_generation',
                resource_type: 'form',
                resource_id: savedForm[0].id,
                details: { form_type: formType, document_count: documentIds.length },
                created_at: new Date().toISOString()
            })
        });

        return new Response(JSON.stringify({
            data: {
                form: savedForm[0],
                template: template,
                extractedData: combinedData
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