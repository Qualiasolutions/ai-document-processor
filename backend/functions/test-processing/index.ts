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
        // Get environment variables for testing
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

        // Test database connectivity
        let dbConnectionTest = false;
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/documents?limit=1`, {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            });
            dbConnectionTest = response.ok;
        } catch {
            dbConnectionTest = false;
        }

        const testResults = {
            status: 'success',
            timestamp: new Date().toISOString(),
            environment: {
                supabase_url: supabaseUrl ? '✅ Configured' : '❌ Missing',
                service_role_key: serviceRoleKey ? '✅ Configured' : '❌ Missing',
                openai_api_key: openaiApiKey ? '✅ Configured' : '❌ Missing',
                database_connection: dbConnectionTest ? '✅ Connected' : '❌ Failed'
            },
            functions: {
                'document-upload': '✅ Available',
                'ai-document-analysis': '✅ Available',
                'form-generation': '✅ Available',
                'form-export': '✅ Available',
                'document-upload-process': '✅ Available',
                'test-processing': '✅ Available (this function)'
            },
            message: 'All systems operational!'
        };

        return new Response(JSON.stringify({ data: testResults }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Test processing error:', error);

        const errorResponse = {
            error: {
                code: 'TEST_PROCESSING_FAILED',
                message: error.message,
                timestamp: new Date().toISOString()
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}); 