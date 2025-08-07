# API Documentation - Qualia AI Form-Filler Pro

## 🔗 API Overview

The Qualia AI Form-Filler Pro uses Supabase as the backend, providing REST APIs, real-time subscriptions, and Edge Functions for advanced processing.

## 🔐 Authentication

All API requests require authentication via Supabase Auth tokens.

### Authentication Headers
```http
Authorization: Bearer <supabase_jwt_token>
apikey: <supabase_anon_key>
```

## 📋 Database API Endpoints

### Users & Profiles

#### Get User Profile
```http
GET /rest/v1/profiles?select=*&id=eq.{user_id}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "avatar_url": "https://...",
  "preferences": {
    "theme": "light",
    "notifications": true
  },
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Update User Profile
```http
PATCH /rest/v1/profiles?id=eq.{user_id}
Content-Type: application/json

{
  "full_name": "John Doe Updated",
  "preferences": {
    "theme": "dark",
    "notifications": false
  }
}
```

### Documents

#### Get User Documents
```http
GET /rest/v1/documents?select=*&user_id=eq.{user_id}&order=created_at.desc
```

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "filename": "passport.pdf",
    "file_path": "user_id/document_id.pdf",
    "file_size": 1024000,
    "mime_type": "application/pdf",
    "status": "processed",
    "processing_result": {
      "extracted_data": {
        "name": "John Doe",
        "passport_number": "123456789"
      },
      "document_type": "passport",
      "confidence": 0.95
    },
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Get Single Document
```http
GET /rest/v1/documents?select=*&id=eq.{document_id}&user_id=eq.{user_id}
```

#### Delete Document
```http
DELETE /rest/v1/documents?id=eq.{document_id}&user_id=eq.{user_id}
```

### Generated Forms

#### Get User Forms
```http
GET /rest/v1/generated_forms?select=*,form_templates(name,category)&user_id=eq.{user_id}&order=created_at.desc
```

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid", 
    "document_id": "uuid",
    "form_type": "visa_application",
    "form_data": {
      "personal_info": {
        "full_name": "John Doe",
        "date_of_birth": "1990-01-01",
        "passport_number": "123456789"
      },
      "travel_info": {
        "destination": "United States",
        "purpose": "Tourism"
      }
    },
    "template_id": "uuid",
    "created_at": "2024-01-01T00:00:00Z",
    "form_templates": {
      "name": "US Visa Application",
      "category": "immigration"
    }
  }
]
```

#### Create Form
```http
POST /rest/v1/generated_forms
Content-Type: application/json

{
  "document_id": "uuid",
  "form_type": "visa_application",
  "form_data": {
    "personal_info": {
      "full_name": "John Doe"
    }
  },
  "template_id": "uuid"
}
```

#### Update Form
```http
PATCH /rest/v1/generated_forms?id=eq.{form_id}&user_id=eq.{user_id}
Content-Type: application/json

{
  "form_data": {
    "personal_info": {
      "full_name": "John Doe Updated"
    }
  }
}
```

### Form Templates

#### Get Available Templates
```http
GET /rest/v1/form_templates?select=*&or=(is_public.eq.true,created_by.eq.{user_id})
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "US Visa Application",
    "description": "Form for US tourist visa application",
    "fields": [
      {
        "name": "full_name",
        "label": "Full Name",
        "type": "text",
        "required": true
      },
      {
        "name": "passport_number", 
        "label": "Passport Number",
        "type": "text",
        "required": true
      }
    ],
    "category": "immigration",
    "is_public": true,
    "created_by": "uuid"
  }
]
```

#### Create Custom Template
```http
POST /rest/v1/form_templates
Content-Type: application/json

{
  "name": "Custom Employment Form",
  "description": "Custom form for employment applications",
  "fields": [
    {
      "name": "full_name",
      "label": "Full Name", 
      "type": "text",
      "required": true
    }
  ],
  "category": "employment",
  "is_public": false
}
```

## 🚀 Edge Functions API

### Document Upload

#### Upload Document
```http
POST /functions/v1/document-upload
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>

FormData:
- file: <file_data>
- filename: "document.pdf"
```

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "filename": "document.pdf",
    "file_path": "user_id/document_id.pdf",
    "status": "uploaded"
  },
  "message": "Document uploaded successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid file type",
  "details": "Only PDF, JPG, PNG, and DOCX files are allowed"
}
```

### Document Processing

#### Process Document
```http
POST /functions/v1/document-processing
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "document_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "processing_id": "uuid",
  "status": "processing",
  "message": "Document processing started"
}
```

#### Get Processing Status
```http
GET /functions/v1/document-processing?document_id={document_id}
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "status": "completed",
  "progress": 100,
  "result": {
    "extracted_data": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "document_type": "employment_contract",
    "confidence": 0.92
  }
}
```

### AI Document Analysis

#### Analyze Document Content
```http
POST /functions/v1/ai-document-analysis
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "document_id": "uuid",
  "analysis_type": "full", // or "quick"
  "target_form_type": "visa_application" // optional
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "document_type": "passport",
    "extracted_data": {
      "full_name": "John Doe",
      "passport_number": "123456789",
      "date_of_birth": "1990-01-01",
      "nationality": "US",
      "issue_date": "2020-01-01",
      "expiry_date": "2030-01-01"
    },
    "confidence_score": 0.95,
    "suggested_form_types": ["visa_application", "travel_insurance"],
    "processing_time_ms": 2500
  }
}
```

### Form Generation

#### Generate Form from Document
```http
POST /functions/v1/form-generation
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "document_id": "uuid",
  "form_type": "visa_application",
  "template_id": "uuid" // optional
}
```

**Response:**
```json
{
  "success": true,
  "form": {
    "id": "uuid",
    "form_type": "visa_application",
    "form_data": {
      "personal_info": {
        "full_name": "John Doe",
        "date_of_birth": "1990-01-01",
        "passport_number": "123456789"
      },
      "contact_info": {
        "email": "john@example.com",
        "phone": "+1234567890"
      }
    },
    "auto_filled_fields": ["full_name", "passport_number", "date_of_birth"],
    "confidence_scores": {
      "full_name": 0.98,
      "passport_number": 0.95,
      "date_of_birth": 0.92
    }
  }
}
```

### Form Export

#### Export Form to PDF/DOCX
```http
POST /functions/v1/form-export
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "form_id": "uuid",
  "format": "pdf", // or "docx", "json"
  "include_metadata": true
}
```

**Response:**
```json
{
  "success": true,
  "export": {
    "id": "uuid",
    "format": "pdf",
    "file_url": "https://storage.supabase.co/v1/object/sign/qualia-exports/user_id/form_id.pdf?token=...",
    "expires_at": "2024-01-02T00:00:00Z",
    "file_size": 204800
  }
}
```

## 📡 Real-time Subscriptions

### Document Processing Updates

```typescript
// Subscribe to processing status updates
const subscription = supabase
  .channel('document-processing')
  .on('postgres_changes', 
    {
      event: 'UPDATE',
      schema: 'public', 
      table: 'documents',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('Processing update:', payload.new);
    }
  )
  .subscribe();
```

### Form Updates

```typescript
// Subscribe to form changes
const subscription = supabase
  .channel('form-updates')
  .on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'generated_forms', 
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('Form update:', payload);
    }
  )
  .subscribe();
```

## 📁 File Storage API

### Upload File
```http
POST /storage/v1/object/qualia-documents/{user_id}/{filename}
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>

FormData:
- file: <file_data>
```

### Download File
```http
GET /storage/v1/object/qualia-documents/{user_id}/{filename}
Authorization: Bearer <jwt_token>
```

### Get Signed URL
```http
POST /storage/v1/object/sign/qualia-documents/{user_id}/{filename}
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "expiresIn": 3600 // seconds
}
```

**Response:**
```json
{
  "signedURL": "https://storage.supabase.co/v1/object/sign/qualia-documents/user_id/filename?token=..."
}
```

## ❌ Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": "Error type",
  "message": "Human readable error message",
  "details": "Additional error details",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication required |
| `INVALID_TOKEN` | Invalid or expired token |
| `PERMISSION_DENIED` | Insufficient permissions |
| `INVALID_INPUT` | Invalid request data |
| `FILE_TOO_LARGE` | File exceeds size limit |
| `UNSUPPORTED_FORMAT` | Unsupported file format |
| `PROCESSING_FAILED` | Document processing failed |
| `AI_SERVICE_ERROR` | OpenAI API error |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

## 🔄 Rate Limiting

### Limits by Endpoint

| Endpoint | Limit | Window |
|----------|-------|--------|
| Document Upload | 10 requests | 1 minute |
| AI Processing | 5 requests | 1 minute |
| Form Generation | 20 requests | 1 minute |
| Database Queries | 100 requests | 1 minute |
| File Downloads | 50 requests | 1 minute |

### Rate Limit Headers
```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1609459200
```

## 📊 Usage Analytics API

### Get User Analytics
```http
GET /rest/v1/user_analytics?select=*&user_id=eq.{user_id}&order=date.desc
```

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "date": "2024-01-01",
    "documents_processed": 5,
    "forms_generated": 8,
    "processing_time_total": 45000,
    "api_calls": 23,
    "storage_used": 10485760
  }
]
```

## 🔧 Webhook Configuration

### Processing Completion Webhook
```http
POST {your_webhook_url}
Content-Type: application/json

{
  "event": "document.processing.completed",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "document_id": "uuid",
    "user_id": "uuid",
    "status": "completed",
    "processing_result": {
      "extracted_data": {...},
      "confidence": 0.95
    }
  }
}
```

---

This API documentation provides comprehensive coverage of all available endpoints and real-time features for integrating with the Qualia AI Form-Filler Pro application.
