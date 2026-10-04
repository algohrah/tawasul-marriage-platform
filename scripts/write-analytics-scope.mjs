import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
// Build-time context is non-secret and available to Netlify builds, while its
// CONTEXT/REVIEW_ID variables are not guaranteed at function runtime.
export function buildAnalyticsScope(env=process.env) {
  const previewHost=String(env.DEPLOY_PRIME_URL || '').match(/deploy-preview-(\d+)--/);
  if(env.CONTEXT==='deploy-preview' || previewHost) {
    const id=String(env.REVIEW_ID || previewHost?.[1] || 'current');
    return `preview:${/^\d+$/.test(id) ? id : 'current'}`;
  }
  if(env.CONTEXT==='branch-deploy')return 'branch-preview';
  if(env.CONTEXT==='production')return 'production';
  return null;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  writeFileSync(new URL('../api/_visitorAnalyticsScope.js',import.meta.url),`// Generated non-secret analytics scope; local builds default to host detection.\nexport default ${JSON.stringify(buildAnalyticsScope())};\n`);
}
