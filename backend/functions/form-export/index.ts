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
        const { formId, format, title } = await req.json();

        if (!formId || !format) {
            throw new Error('Form ID and format are required');
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

        // Fetch form data
        const formResponse = await fetch(`${supabaseUrl}/rest/v1/generated_forms?id=eq.${formId}`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!formResponse.ok) {
            throw new Error('Failed to fetch form');
        }

        const forms = await formResponse.json();
        if (forms.length === 0) {
            throw new Error('Form not found');
        }

        const form = forms[0];

        // Verify user owns the form
        if (form.user_id !== userId) {
            throw new Error('Access denied');
        }

        let exportData;
        let mimeType;
        let fileExtension;

        if (format === 'json') {
            exportData = JSON.stringify({
                title: title || form.title,
                form_type: form.form_type,
                created_at: form.created_at,
                data: form.form_data
            }, null, 2);
            mimeType = 'application/json';
            fileExtension = 'json';
        } else if (format === 'csv') {
            // Convert form data to CSV
            const headers = Object.keys(form.form_data);
            const values = Object.values(form.form_data);
            exportData = headers.join(',') + '\n' + values.map(v => `"${v || ''}"`).join(',');
            mimeType = 'text/csv';
            fileExtension = 'csv';
        } else {
            // For PDF and other formats, create HTML representation
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${title || form.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; }
        .value { margin-top: 5px; padding: 5px; border: 1px solid #ccc; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title || form.title}</h1>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
    </div>
    
    ${Object.entries(form.form_data).map(([key, value]) => `
        <div class="field">
            <div class="label">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</div>
            <div class="value">${value || ''}</div>
        </div>
    `).join('')}
</body>
</html>`;
            
            exportData = htmlContent;
            mimeType = 'text/html';
            fileExtension = 'html';
        }

        // Generate filename
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const fileName = `${form.form_type}_${timestamp}.${fileExtension}`;
        const filePath = `${userId}/${fileName}`;

        // Upload to storage
        const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/qualia-exports/${filePath}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': mimeType,
                'x-upsert': 'true'
            },
            body: exportData
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload failed: ${errorText}`);
        }

        const fileUrl = `${supabaseUrl}/storage/v1/object/public/qualia-exports/${filePath}`;

        // Record export in history
        await fetch(`${supabaseUrl}/rest/v1/export_history`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                form_id: formId,
                export_format: format,
                file_url: fileUrl,
                file_size: new TextEncoder().encode(exportData).length,
                exported_at: new Date().toISOString()
            })
        });

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
                action: 'form_export',
                resource_type: 'form',
                resource_id: formId,
                details: { format: format, file_size: new TextEncoder().encode(exportData).length },
                created_at: new Date().toISOString()
            })
        });

        return new Response(JSON.stringify({
            data: {
                fileUrl: fileUrl,
                fileName: fileName,
                format: format,
                fileSize: new TextEncoder().encode(exportData).length
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Form export error:', error);

        const errorResponse = {
            error: {
                code: 'FORM_EXPORT_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});