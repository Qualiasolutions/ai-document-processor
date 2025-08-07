# Deployment Guide - Qualia AI Form-Filler Pro

## 🚀 Quick Start Deployment

This guide will help you deploy the AI Form-Filler Pro application to production.

## Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **OpenAI API Key**: Get from [platform.openai.com](https://platform.openai.com)
3. **Node.js 18+**: For building the frontend
4. **Supabase CLI**: For backend deployment

## Step 1: Supabase Project Setup

### 1.1 Create New Project
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose organization and enter project details
4. Wait for project initialization (2-3 minutes)

### 1.2 Get Project Credentials
From your Supabase dashboard:
1. Go to Settings → API
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public key**
   - **service_role key** (keep secret)

## Step 2: Database Setup

### 2.1 Install Supabase CLI
```bash
npm install -g supabase
```

### 2.2 Login to Supabase
```bash
supabase login
```

### 2.3 Link to Your Project
```bash
cd backend/
supabase link --project-ref YOUR_PROJECT_ID
```

### 2.4 Deploy Database Schema
```bash
# Deploy all tables and RLS policies
supabase db push

# Or manually run SQL files
supabase db reset
```

### 2.5 Create Storage Buckets
```bash
# Deploy bucket creation functions
supabase functions deploy create-bucket-qualia-documents-temp
supabase functions deploy create-bucket-qualia-exports-temp

# Or create manually in Supabase dashboard:
# 1. Go to Storage
# 2. Create bucket "qualia-documents" (private)
# 3. Create bucket "qualia-exports" (private)
```

## Step 3: Edge Functions Deployment

### 3.1 Set Environment Variables
In Supabase Dashboard → Edge Functions → Environment Variables:
```
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
```

### 3.2 Deploy Functions
```bash
cd backend/

# Deploy all functions
supabase functions deploy document-upload
supabase functions deploy document-processing
supabase functions deploy form-generation
supabase functions deploy ai-document-analysis
supabase functions deploy form-export
```

### 3.3 Test Functions
```bash
# Test document upload
supabase functions deploy test-env
```

## Step 4: Frontend Deployment

### 4.1 Configure Environment
Create `frontend/.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_OPENAI_API_KEY=sk-proj-your-openai-api-key-here
```

### 4.2 Build Application
```bash
cd frontend/
pnpm install
pnpm build
```

### 4.3 Deploy to Hosting Service

#### Option A: Vercel (Recommended)
1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel --prod`
3. Set environment variables in Vercel dashboard

#### Option B: Netlify
1. Install Netlify CLI: `npm i -g netlify-cli`
2. Deploy: `netlify deploy --prod --dir=dist`
3. Set environment variables in Netlify dashboard

#### Option C: Static Hosting
Upload the `dist/` folder to any static hosting service:
- AWS S3 + CloudFront
- Cloudflare Pages
- GitHub Pages

## Step 5: Authentication Setup

### 5.1 Configure Auth Settings
In Supabase Dashboard → Authentication → Settings:

1. **Site URL**: Set to your deployed frontend URL
2. **Redirect URLs**: Add your domain
   ```
   https://yourdomain.com/**
   https://yourdomain.com/auth/callback
   ```

### 5.2 Email Templates (Optional)
Customize email templates in Authentication → Email Templates

### 5.3 OAuth Providers (Optional)
Enable social logins in Authentication → Providers

## Step 6: Security Configuration

### 6.1 Row Level Security
Ensure RLS is enabled on all tables (already configured in schema)

### 6.2 API Rate Limiting
Configure in Supabase Dashboard → Settings → API

### 6.3 CORS Settings
Add your domain to allowed origins in Supabase

## Step 7: Production Verification

### 7.1 Test Complete Workflow
1. **Registration**: Create new user account
2. **Login**: Verify authentication works
3. **Upload**: Test document upload
4. **Processing**: Verify AI analysis works
5. **Forms**: Check form generation
6. **Export**: Test form export functionality

### 7.2 Monitor Performance
- Check Supabase Dashboard for usage metrics
- Monitor Edge Function logs
- Verify database performance

## Environment Variables Reference

### Frontend (.env.local)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_OPENAI_API_KEY=sk-proj-your-key-here
```

### Supabase Edge Functions
```env
OPENAI_API_KEY=sk-proj-your-key-here
```

## Troubleshooting

### Common Issues

1. **Edge Function 500 Errors**
   - Check environment variables are set
   - Verify OpenAI API key is valid
   - Check function logs in Supabase dashboard

2. **Authentication Issues**
   - Verify Site URL and Redirect URLs
   - Check RLS policies
   - Ensure anon key is correct

3. **File Upload Failures**
   - Check storage bucket permissions
   - Verify RLS policies on storage
   - Check file size limits

4. **Database Connection Issues**
   - Verify database is accessible
   - Check connection pooling settings
   - Review RLS policies

### Performance Optimization

1. **Database Indexing**
   - Ensure proper indexes on frequently queried columns
   - Monitor slow queries

2. **CDN Configuration**
   - Use CDN for static assets
   - Enable compression

3. **Caching Strategy**
   - Implement proper caching headers
   - Use React Query for data caching

## Security Checklist

- [ ] RLS enabled on all tables
- [ ] Environment variables secured
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] Input validation implemented
- [ ] File upload restrictions in place
- [ ] API rate limiting configured
- [ ] User data isolation verified

## Monitoring and Maintenance

### 1. Monitor Usage
- Supabase Dashboard → Project Overview
- Track API requests and database usage
- Monitor storage consumption

### 2. Update Dependencies
```bash
cd frontend/
pnpm update
```

### 3. Backup Database
```bash
supabase db dump > backup.sql
```

### 4. Update Edge Functions
When making changes:
```bash
supabase functions deploy function-name
```

## Support

For deployment issues:
1. Check Supabase logs
2. Review Edge Function logs
3. Verify environment configuration
4. Contact development team

---

**Production Ready**: This deployment guide creates a fully functional, secure, and scalable production environment.
