# LearnDesk Connect v1 prototype
Device-local PWA demo (no backend). All data lives in localStorage (`ldc_v1`).
Run: `python3 -m http.server 8765 --directory app` then open http://localhost:8765/
Pick a role on the demo login (Admin / Teacher / Parent). "Reset demo data" restores the seed.
Wire to Supabase: replace function bodies in `data.js` (`DB` object). The table list and RLS notes are at the top of that file.
Payments: `DB.paystackLink` returns a placeholder DEMO URL; "Simulate payment" stands in for the webhook.
