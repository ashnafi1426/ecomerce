#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 FastShop Frontend Deployment Helper\n');

// Check if dist folder exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.log('❌ Build not found. Please run "npm run build" first.');
  process.exit(1);
}

console.log('✅ Build found in dist/ folder');

// Check environment variables
const envPath = path.join(__dirname, '.env.production');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('ecomerce-backend-1-12i5.onrender.com')) {
    console.log('✅ Backend URL configured correctly');
  } else {
    console.log('⚠️  Backend URL might not be configured correctly');
  }
} else {
  console.log('⚠️  .env.production file not found');
}

// Check for routing configuration files
const routingFiles = [
  { file: 'vercel.json', platform: 'Vercel' },
  { file: 'public/_redirects', platform: 'Netlify' },
  { file: 'public/.htaccess', platform: 'Apache/cPanel' }
];

console.log('\n📁 Routing configuration files:');
routingFiles.forEach(({ file, platform }) => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`✅ ${file} (${platform})`);
  } else {
    console.log(`❌ ${file} (${platform}) - missing`);
  }
});

console.log('\n🎯 Next steps:');
console.log('1. Choose your hosting platform:');
console.log('   • Vercel: Connect GitHub repo or upload dist/ folder');
console.log('   • Netlify: Upload dist/ folder or connect GitHub repo');
console.log('   • Render: Connect GitHub repo as Static Site');
console.log('   • cPanel/Apache: Upload dist/ contents to public_html');

console.log('\n2. Set environment variables on your hosting platform:');
console.log('   VITE_API_URL=https://ecomerce-backend-1-12i5.onrender.com/api');
console.log('   VITE_SOCKET_URL=https://ecomerce-backend-1-12i5.onrender.com');
console.log('   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SxpBYGeSPbKvoudaS1MnfDu0WwmapRtNagFk0kEjGoRjQ5DvU3jmJyEQ3Vo87Cn42MRxlTsNiIPPOGHYKhr0dRl00dcHQSxIE');

console.log('\n3. Test your deployment:');
console.log('   • Navigate to different pages using header links');
console.log('   • Try logging in and making API calls');
console.log('   • Check browser console for errors');

console.log('\n📖 For detailed instructions, see DEPLOYMENT.md');