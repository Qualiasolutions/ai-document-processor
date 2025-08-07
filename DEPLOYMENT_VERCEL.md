# 🚀 Vercel Deployment Guide - AI Document Processor

Deploy your AI Document Processor to Vercel for **FREE** with secure, server-side API handling.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com) (free)
2. **GitHub Account**: For automatic deployments
3. **OpenAI API Key**: From [platform.openai.com](https://platform.openai.com/api-keys)
4. **Supabase Project**: Your existing project `qfldqwfpbabeonvryaof`

## 🔒 Security Features

✅ **No API keys in browser** - All handled server-side  
✅ **Secure serverless functions** - API calls protected  
✅ **Environment variables** - Sensitive data encrypted  
✅ **Professional deployment** - Production-ready setup  

## 📦 Step 1: Prepare Your Code

The project is already prepared with:
- `/api/` directory with serverless functions
- `vercel.json` configuration
- Secure frontend code that calls your API endpoints
- `.env.example` template

## 🔗 Step 2: Connect to GitHub

1. **Push to GitHub** (if not already):
   ```bash
   cd "/home/qualiasolutions/Desktop/Respect Services/compiled-project/frontend"
   git init
   git add .
   git commit -m "Initial commit - secure deployment ready"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ai-document-processor.git
   git push -u origin main
   ```

2. **Or upload via GitHub web interface**:
   - Create new repository on GitHub
   - Upload the `frontend/` folder contents

## 🌐 Step 3: Deploy to Vercel

### Option A: Vercel Dashboard (Recommended)

1. **Go to** [vercel.com/dashboard](https://vercel.com/dashboard)
2. **Click "New Project"**
3. **Import from GitHub** - select your repository
4. **Configure Project**:
   - Framework: `Vite`
   - Root Directory: `./` (if you uploaded just frontend folder)
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **Click "Deploy"**

### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from frontend directory
cd frontend/
vercel --prod
```

## 🔑 Step 4: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

### Required Variables:
```
OPENAI_API_KEY = sk-proj-YOUR_ACTUAL_OPENAI_KEY_HERE
VITE_SUPABASE_URL = https://qfldqwfpbabeonvryaof.supabase.co
VITE_SUPABASE_ANON_KEY = YOUR_SUPABASE_ANON_KEY
```

### Optional Variables:
```
NODE_ENV = production
BUILD_MODE = prod
```

**Important**: Never put real API keys in your code - only in Vercel environment variables!

## ✅ Step 5: Test Your Deployment

1. **Visit your Vercel URL** (e.g., `https://your-app.vercel.app`)
2. **Test document upload** with a sample file
3. **Check API health** at `/api/health`
4. **Verify secure processing** (no API keys in browser)

### Testing Checklist:
- [ ] Website loads without errors
- [ ] File upload works
- [ ] AI analysis processes successfully  
- [ ] Forms generate correctly
- [ ] No API keys visible in browser dev tools
- [ ] `/api/health` shows all services as "configured"

## 🔄 Step 6: Automatic Deployments

Once connected to GitHub:
- **Push changes** → Vercel automatically deploys
- **Preview deployments** for pull requests
- **Production deployments** on main branch

## 🛠️ Customization

### Custom Domain (Optional)
1. Go to Vercel Dashboard → Settings → Domains
2. Add your domain name
3. Configure DNS records as shown
4. Vercel automatically provisions SSL

### Environment-Specific Settings
```bash
# Development
vercel env add OPENAI_API_KEY development

# Production  
vercel env add OPENAI_API_KEY production
```

## 📊 Monitoring

### Vercel Dashboard Features:
- **Real-time analytics** - Page views, performance
- **Function logs** - Debug API issues
- **Performance insights** - Core Web Vitals
- **Usage metrics** - Stay within free tier limits

### Free Tier Limits:
- **Bandwidth**: 100GB/month
- **Function executions**: 100GB-hrs/month
- **Build minutes**: 6000 minutes/month
- **Serverless functions**: Up to 12 seconds execution

## 🚨 Troubleshooting

### Common Issues:

#### 1. Build Fails
```bash
# Check build command in package.json
npm run build

# Ensure all dependencies are installed
npm install
```

#### 2. API Functions Not Working
- Verify environment variables are set in Vercel
- Check function logs in Vercel dashboard
- Test API endpoint: `/api/health`

#### 3. 500 Errors
```bash
# Check Vercel function logs
vercel logs

# Verify OpenAI API key is valid
curl -H "Authorization: Bearer YOUR_KEY" https://api.openai.com/v1/models
```

#### 4. CORS Issues
The `vercel.json` already includes CORS headers. If issues persist:
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" }
      ]
    }
  ]
}
```

#### 5. Environment Variables Not Loading
- Ensure variables are set in Vercel dashboard
- Redeploy after adding variables
- Check variable names match exactly

## 📱 Alternative: Netlify Deployment

If you prefer Netlify, use the included `netlify.toml`:

1. **Deploy to Netlify**:
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod --dir=dist
   ```

2. **Set environment variables** in Netlify dashboard
3. **Functions will be available** at `/.netlify/functions/`

## 🎯 Production Checklist

Before going live:
- [ ] Environment variables configured
- [ ] Custom domain set up (optional)
- [ ] Analytics configured
- [ ] Error monitoring enabled
- [ ] Performance optimized
- [ ] Security headers configured (✅ already done)
- [ ] HTTPS enforced (✅ automatic)

## 💰 Cost Breakdown

### Vercel (FREE):
- Hosting: **$0**
- Serverless functions: **$0** (up to 100GB-hrs)
- Custom domain: **$0**
- SSL certificate: **$0**

### OpenAI:
- GPT-3.5-turbo: **$0.001** per 1K tokens
- GPT-4o (vision): **$0.01** per image
- Estimated: **$5-10/month** for moderate usage

### Total Monthly Cost: **$5-10** (OpenAI only)

## 🚀 Going Live

Your app will be live at: `https://your-app.vercel.app`

### Next Steps:
1. **Share with users** - No authentication required
2. **Monitor usage** - Check Vercel analytics
3. **Scale as needed** - Upgrade to Pro if you exceed limits
4. **Iterate and improve** - Push updates to GitHub

## 📞 Support

- **Vercel Issues**: [vercel.com/support](https://vercel.com/support)
- **OpenAI Issues**: [help.openai.com](https://help.openai.com)
- **Supabase Issues**: [supabase.com/support](https://supabase.com/support)

---

**🎉 Congratulations!** Your AI Document Processor is now live, secure, and professional!