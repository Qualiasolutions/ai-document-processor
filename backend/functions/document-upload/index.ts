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
        const { fileData, fileName, fileType } = await req.json();

        if (!fileData || !fileName) {
            throw new Error('File data and filename are required');
        }

        // Get environment variables
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        // No authentication required - create anonymous user session
        const userId = null; // Allow null user_id for anonymous uploads
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

        // Extract text content based on file type
        let content = '';
        let extractedText = '';
        let processingError = null;
        
        try {
            if (mimeType === 'text/plain' || mimeType === 'text/csv') {
                content = new TextDecoder().decode(binaryData);
                extractedText = content;
            } else if (mimeType === 'application/pdf') {
                // For PDF, we'll store the filename and process it later with OpenAI Vision
                content = `PDF file: ${fileName} - Will be processed with OCR`;
                extractedText = '';
            } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.toLowerCase().endsWith('.docx')) {
                // DOCX processing - extract text content
                try {
                    // For now, we'll store the file and let the frontend handle extraction
                    // But we'll add a flag to indicate it needs processing
                    content = `DOCX file: ${fileName} - Text extraction required`;
                    extractedText = '';
                    
                    // TODO: Add server-side DOCX extraction using a Deno-compatible library
                    console.log('DOCX file uploaded, will be processed by frontend mammoth library');
                    
                } catch (docxError) {
                    console.error('DOCX processing error:', docxError);
                    processingError = `DOCX processing failed: ${docxError.message}`;
                    content = `DOCX file: ${fileName} - Processing failed`;
                }
            } else {
                content = `Document file: ${fileName} - Type: ${mimeType}`;
                extractedText = '';
            }
        } catch (extractionError) {
            console.error('Text extraction error:', extractionError);
            processingError = `Text extraction failed: ${extractionError.message}`;
            content = `Document file: ${fileName} - Extraction failed`;
        }

        // Save document metadata to database (user_id can be null for anonymous uploads)
        const documentData = {
            user_id: userId, // null for anonymous
            filename: fileName,
            file_url: fileUrl,
            file_size: binaryData.length,
            file_type: mimeType,
            content: content,
            extracted_text: extractedText,
            status: processingError ? 'upload_error' : 'uploaded',
            processing_status: processingError ? 'failed' : 'uploaded',
            processing_error: processingError,
            metadata: {
                session_id: sessionId,
                public_url: fileUrl,
                upload_timestamp: timestamp,
                requires_text_extraction: mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.toLowerCase().endsWith('.docx'),
                extraction_method: mimeType === 'text/plain' ? 'direct' : 
                                 mimeType === 'application/pdf' ? 'ocr_pending' :
                                 fileName.toLowerCase().endsWith('.docx') ? 'mammoth_pending' : 'unknown'
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

        // Log the action (optional for anonymous uploads)
        try {
            await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId, // null for anonymous
                    action: 'document_upload',
                    resource_type: 'document',
                    resource_id: document[0].id,
                    details: { 
                        filename: fileName, 
                        file_size: binaryData.length,
                        session_id: sessionId,
                        anonymous: true
                    },
                    created_at: new Date().toISOString()
                })
            });
        } catch (logError) {
            console.warn('Failed to log audit entry:', logError);
            // Don't fail upload if logging fails
        }

        return new Response(JSON.stringify({
            data: {
                document: document[0],
                fileUrl: fileUrl
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Document upload error:', error);

        const errorResponse = {
            error: {
                code: 'DOCUMENT_UPLOAD_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});