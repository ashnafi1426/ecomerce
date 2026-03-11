#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 FastShop Frontend Deployment Helper\n');

// Check if dist folder exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.log('❌ Build files not found. Please run "npm run build" first.');
  process.exit(1);
}

console.log('✅ Build files found in dist/ folder');
console.log('📦 Your frontend is ready for deployment!\n');

console.log('🌐 Backend Configuration:');
console.log('   API URL: https://ecomerce-backend-1-12i5.onrender.com/api');
console.log('   Socket URL: https://ecomerce-backend-1-12i5.onrender.com\n');

console.log('📋 Deployment Options:\n');

console.log('1️⃣  NETLIFY (Recommended)');
console.log('   • Go to https://netlify.com');
console.log('   • Drag and drop the "dist" folder');
console.log('   • Or connect your GitHub repository\n');

console.log('2️⃣  VERCEL');
console.log('   • Go to https://vercel.com');
console.log('   • Import your GitHub repository');
console.log('   • Build command: npm run build');
console.log('   • Output directory: dist\n');

console.log('3️⃣  RENDER (Static Site)');
console.log('   • Go to https://render.com');
console.log('   • Create new Static Site');
console.log('   • Build command: npm run build');
console.log('   • Publish directory: dist\n');

console.log('4️⃣  GITHUB PAGES');
console.log('   • Push your code to GitHub');
console.log('   • Go to repository Settings > Pages');
console.log('   • Deploy from GitHub Actions\n');

console.log('5️⃣  MANUAL UPLOAD');
console.log('   • Upload contents of "dist" folder to your web host');
console.log('   • Make sure to upload all files and folders\n');

console.log('🔧 Environment Variables (if needed):');
console.log('   VITE_API_URL=https://ecomerce-backend-1-12i5.onrender.com/api');
console.log('   VITE_SOCKET_URL=https://ecomerce-backend-1-12i5.onrender.com');
console.log('   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SxpBYGeSPbKvoudaS1MnfDu0WwmapRtNagFk0kEjGoRjQ5DvU3jmJyEQ3Vo87Cn42MRxlTsNiIPPOGHYKhr0dRl00dcHQSxIE\n');

console.log('💡 Tips:');
console.log('   • Test your deployment with "npm run preview" locally');
console.log('   • Make sure your backend is running at the configured URL');
console.log('   • Check browser console for any API connection errors\n');

console.log('🎉 Happy deploying!');