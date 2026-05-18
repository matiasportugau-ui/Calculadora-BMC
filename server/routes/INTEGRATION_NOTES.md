// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
// Integration snippet for server/index.js
// Add these two lines to the existing server entry point:
//
//   import marketingRouter from './routes/marketing.js';
//   import './lib/marketIntel/scheduler.js';             // activates daily cron
//
// Then mount the router AFTER existing middleware, protected by requireAuth:
//   app.use('/api/marketing', requireAuth, marketingRouter);
//
// The requireAuth middleware already exists at server/middleware/requireAuth.js.
// No changes to that file are needed.
//
// For /hub/marketing frontend route, add to src/App.jsx:
//   import MarketingHubModule from './components/MarketingHubModule.jsx';
//   <Route path="/hub/marketing" element={<ProtectedRoute><MarketingHubModule /></ProtectedRoute>} />
