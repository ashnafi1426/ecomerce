# Frontend Deployment Guide

## Backend Configuration
Your backend is deployed at: `https://ecomerce-backend-1-12i5.onrender.com/`

## Environment Setup
The frontend has been configured to connect to your deployed backend:
- API URL: `https://ecomerce-backend-1-12i5.onrender.com/api`
- Socket URL: `https://ecomerce-backend-1-12i5.onrender.com`

## Build and Deploy Steps

### 1. Install Dependencies
```bash
cd ecomerce/ecommerce_client
npm install
```

### 2. Build for Production
```bash
npm run build
```

### 3. Test Locally (Optional)
```bash
npm run preview
```

## Deployment Options

### Option 1: Netlify
1. Build the project: `npm run build`
2. Upload the `dist` folder to Netlify
3. Set environment variables in Netlify dashboard
4. The `_redirects` file is already configured for client-side routing

### Option 2: Vercel
1. Connect your GitHub repository to Vercel
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables in Vercel dashboard
5. The `vercel.json` file is already configured

### Option 3: Render (Static Site)
1. Connect your GitHub repository to Render
2. Choose "Static Site" service
3. Set build command: `npm run build`
4. Set publish directory: `dist`

### Option 4: Apache/cPanel Hosting
1. Build the project: `npm run build`
2. Upload the contents of the `dist` folder to your hosting provider
3. The `.htaccess` file is already configured for client-side routing

## Environment Variables for Production
Make sure these are set in your hosting platform:
```
VITE_API_URL=https://ecomerce-backend-1-12i5.onrender.com/api
VITE_SOCKET_URL=https://ecomerce-backend-1-12i5.onrender.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SxpBYGeSPbKvoudaS1MnfDu0WwmapRtNagFk0kEjGoRjQ5DvU3jmJyEQ3Vo87Cn42MRxlTsNiIPPOGHYKhr0dRl00dcHQSxIE
```

## Common Header Link Issues After Deployment

### Problem: Links return 404 errors
**Cause**: Server doesn't know how to handle client-side routing

**Solutions**:
1. **Netlify**: The `_redirects` file is already configured
2. **Vercel**: The `vercel.json` file is already configured  
3. **Apache**: The `.htaccess` file is already configured
4. **Nginx**: Add this to your server config:
   ```nginx
   location / {
     try_files $uri $uri/ /index.html;
   }
   ```

### Problem: Links work but show wrong content
**Cause**: Environment variables not set correctly

**Solution**: Verify all environment variables are set in your hosting platform

### Problem: API calls fail
**Cause**: CORS or incorrect API URL

**Solutions**:
1. Check that your backend allows requests from your frontend domain
2. Verify the API URL is correct in environment variables
3. Check browser network tab for specific error messages

### Problem: Socket connections fail
**Cause**: WebSocket configuration issues

**Solution**: Ensure your hosting platform supports WebSockets and the SOCKET_URL is correct

## Testing Your Deployment

1. **Check the console**: Open browser dev tools and look for errors
2. **Test navigation**: Click all header links to ensure they work
3. **Test API calls**: Try logging in, adding to cart, etc.
4. **Test on mobile**: Ensure responsive design works correctly

## Quick Fixes

If you're still having issues:

1. **Clear browser cache** and try again
2. **Check environment variables** in your hosting platform
3. **Verify build output** - the `dist` folder should contain `index.html` and assets
4. **Test locally first** with `npm run preview` to ensure the build works