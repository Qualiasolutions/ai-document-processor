/**
 * Enhanced Document Upload Function
 * Combines file upload with AI processing using new AI service abstraction
 * Eliminates OpenAI dependency issues and provides better reliability
 */

// Import AI service
import { AIService } from '../ai-service/index.ts';

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

        // Initialize AI service
        const aiService = new AIService();

        // Extract text content and perform AI analysis
        let content = '';
        let aiAnalysis = null;
        let processingStatus = 'uploaded';
        let errorMessage = null;

        try {
            processingStatus = 'processing';
            
            if (mimeType === 'text/plain' || mimeType === 'text/csv') {
                // Direct text extraction
                content = new TextDecoder().decode(binaryData);
                console.log('Extracted text from plain text file:', content.length, 'characters');
                
                // Analyze the extracted text
                aiAnalysis = await aiService.analyzeDocument(content);
                processingStatus = 'completed';
                
            } else if (mimeType?.startsWith('image/') || mimeType === 'application/pdf') {
                // Use AI OCR for images and PDFs
                console.log('Starting OCR processing for:', fileName, 'type:', mimeType);
                
                const ocrResult = await aiService.extractTextFromImage(fileData);
                content = ocrResult.text;
                console.log('OCR extracted text:', content.length, 'characters');
                
                // Analyze the extracted text
                aiAnalysis = await aiService.analyzeDocument(content);
                processingStatus = 'completed';
                
            } else {
                // Unsupported file type
                content = `Unsupported file type: ${fileName} (${mimeType})`;
                processingStatus = 'unsupported';
            }
            
        } catch (aiError) {
            console.error('AI processing error:', aiError);
            errorMessage = aiError instanceof Error ? aiError.message : 'AI processing failed';
            processingStatus = 'failed';
            
            // Set fallback content
            if (!content) {
                content = `Document file: ${fileName} (AI processing failed: ${errorMessage})`;
            }
        }

        // Save document metadata to database
        const documentData = {
            user_id: userId, // null for anonymous
            filename: fileName,
            file_url: fileUrl,
            file_size: binaryData.length,
            file_type: mimeType,
            content: content,
            status: 'uploaded',
            processing_status: processingStatus,
            metadata: {
                session_id: sessionId,
                public_url: fileUrl,
                upload_timestamp: timestamp,
                ai_processing: {
                    status: processingStatus,
                    error: errorMessage,
                    provider_used: aiService.constructor.name
                }
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
        const documentId = document[0].id;

        // Save AI analysis results if successful
        if (aiAnalysis && processingStatus === 'completed') {
            try {
                // Save document extraction
                const extractionData = {
                    document_id: documentId,
                    user_id: userId,
                    extraction_data: aiAnalysis.extracted_data,
                    confidence_score: aiAnalysis.confidence,
                    document_type: aiAnalysis.document_type,
                    processing_metadata: {
                        suggested_form: aiAnalysis.suggested_form,
                        ai_provider: 'enhanced-service',
                        processing_time: Date.now() - timestamp
                    },
                    created_at: new Date().toISOString()
                };

                await fetch(`${supabaseUrl}/rest/v1/document_extractions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(extractionData)
                });

                // Generate initial form if we have a suggested form type
                if (aiAnalysis.suggested_form) {
                    const formData = {
                        document_id: documentId,
                        user_id: userId,
                        form_type: aiAnalysis.suggested_form,
                        form_data: aiAnalysis.extracted_data,
                        status: 'generated',
                        confidence_score: aiAnalysis.confidence,
                        metadata: {
                            auto_generated: true,
                            ai_provider: 'enhanced-service',
                            generation_timestamp: timestamp
                        },
                        created_at: new Date().toISOString()
                    };

                    await fetch(`${supabaseUrl}/rest/v1/generated_forms`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(formData)
                    });
                }

            } catch (saveError) {
                console.error('Failed to save AI analysis results:', saveError);
                // Don't fail the entire request if AI result saving fails
            }
        }

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
                    action: 'document_upload_enhanced',
                    resource_type: 'document',
                    resource_id: documentId,
                    details: { 
                        filename: fileName, 
                        file_size: binaryData.length,
                        session_id: sessionId,
                        anonymous: true,
                        ai_processing: {
                            status: processingStatus,
                            confidence: aiAnalysis?.confidence || null,
                            document_type: aiAnalysis?.document_type || null
                        }
                    },
                    created_at: new Date().toISOString()
                })
            });
        } catch (logError) {
            console.warn('Failed to log audit entry:', logError);
            // Don't fail upload if logging fails
        }

        // Return comprehensive response
        const responseData = {
            data: {
                document: document[0],
                fileUrl: fileUrl,
                processing: {
                    status: processingStatus,
                    error: errorMessage,
                    content_length: content.length
                }
            }
        };

        // Include AI analysis if successful
        if (aiAnalysis) {
            responseData.data.analysis = {
                document_type: aiAnalysis.document_type,
                confidence: aiAnalysis.confidence,
                suggested_form: aiAnalysis.suggested_form,
                extracted_fields: Object.keys(aiAnalysis.extracted_data).length,
                preview: Object.keys(aiAnalysis.extracted_data).slice(0, 3) // Preview of extracted fields
            };
        }

        return new Response(JSON.stringify(responseData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Enhanced document upload error:', error);

        const errorResponse = {
            error: {
                code: 'DOCUMENT_UPLOAD_ENHANCED_FAILED',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});