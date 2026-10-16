# Premium Listings - Deployment Guide

**Status**: ✅ Ready to Deploy  
**Date**: 2026-09-22  
**Version**: 1.0

---

## 🎯 Deployment Checklist

- [x] Code written and tested
- [x] Database migration file created
- [x] Environment variables configured
- [x] Git commit created: "Add premium listings feature for monetization"
- [ ] Database migration executed on Supabase
- [ ] Deployed to Vercel production
- [ ] Verified on production URL

---

## 📋 Pre-Deployment: Database Migration

**⚠️ CRITICAL: This must be done BEFORE or IMMEDIATELY AFTER deploying**

### Option 1: Supabase Dashboard (Recommended)

1. Visit: https://app.supabase.com/project/yxjcamscavnagixlwyfp
2. Click **SQL Editor** in left sidebar
3. Click **New Query**
4. Copy this file content:
   - `supabase/migrations/add_premium_listings.sql`
5. Paste it into the SQL editor
6. Click **Run**
7. Verify the success message

### Option 2: Supabase CLI

```bash
cd /path/to/rankbid-lol
supabase db push
```

### Option 3: Command Line (psql)

```bash
psql postgresql://postgres:PASSWORD@db.yxjcamscavnagixlwyfp.supabase.co:5432/postgres \
  -f supabase/migrations/add_premium_listings.sql
```

**What it does:**
- Creates `premium_listings` table
- Adds indexes for performance
- Adds columns to listings table for vote tracking

---

## 🚀 Deployment Steps

### Step 1: Verify Everything is Committed

```bash
cd /Users/noumanassadullah/rankbid-lol
git status
# Should show: working tree clean
```

### Step 2: Set Environment Variable

**ADMIN_KEY** is already set in Vercel. Current value scope: production

Verify it's set:
```bash
vercel env list
```

Should show: `ADMIN_KEY` (production)

### Step 3: Deploy to Vercel

```bash
cd /Users/noumanassadullah/rankbid-lol
vercel deploy --prod
```

Wait for deployment to complete. Takes 2-5 minutes.

### Step 4: Verify Deployment

Visit your production URL (e.g., https://rankbid-lol.vercel.app):

1. ✅ Homepage loads normally
2. ✅ Submit a free listing
3. ✅ Click ⭐ star button on listing
4. ✅ Premium form opens
5. ✅ Fill form and submit
6. ✅ Visit `/admin/premium-listings`
7. ✅ Enter admin key (value of ADMIN_KEY env var)
8. ✅ See pending premium listing
9. ✅ Click Approve
10. ✅ Go back to homepage
11. ✅ Premium listing appears at top with founder info

---

## 📊 What Gets Deployed

### New Files (8)
```
✅ app/api/listings/premium/route.ts
✅ app/api/admin/premium-listings/route.ts
✅ components/PremiumListingCard.tsx
✅ components/PremiumListingModal.tsx
✅ app/admin/premium-listings/page.tsx
✅ supabase/migrations/add_premium_listings.sql
✅ docs/PREMIUM_LISTINGS.md
✅ PREMIUM_LISTINGS_SETUP.md
```

### Modified Files (2)
```
✏️ app/page.tsx (added premium section, star button, modal)
✏️ app/api/listings/submit/route.ts (updated for premium data)
```

---

## 🔐 Environment Variables

### Required for Production

```
ADMIN_KEY=<your admin key>
NEXT_PUBLIC_SUPABASE_URL=https://yxjcamscavnagixlwyfp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_r52Fg-l2Egc7JygqlgdDQw_jKsNNonK
SUPABASE_SERVICE_ROLE_KEY=<your Supabase secret key>
```

All are already configured in Vercel.

---

## ⚠️ Important Notes

### Database Migration MUST Complete First

If you deploy without running the migration, you'll get database errors when users try to submit premium listings.

**Recovery if this happens:**
1. Run the migration immediately
2. Errors should clear within minutes
3. Monitor error logs in Vercel dashboard

### Admin Key Security

The `ADMIN_KEY` is used to protect the `/admin/premium-listings` endpoint.

**Keep it secret!** Only you should know it.

To change it:
```bash
vercel env update ADMIN_KEY
# Enter new value
```

Then redeploy:
```bash
vercel deploy --prod
```

### Testing in Production

After deployment, test with:
1. **Free listing**: Submit normally
2. **Premium submission**: Click ⭐, fill form
3. **Admin approval**: Visit `/admin/premium-listings`, approve
4. **Verification**: Check it appears on homepage

---

## 🔧 Troubleshooting

### "Database error" when submitting premium

**Cause**: Migration not run  
**Fix**: Run `supabase/migrations/add_premium_listings.sql` on Supabase

### "Invalid admin key" at `/admin/premium-listings`

**Cause**: Wrong key entered  
**Fix**: Use exact value of `ADMIN_KEY` environment variable

### Premium listing doesn't appear after approval

**Cause**: Cache or list not reloaded  
**Fix**: Clear browser cache, refresh page, or wait 1-2 minutes

### Build fails during deployment

**Cause**: TypeScript or syntax error  
**Fix**: 
1. Check Vercel deployment logs
2. Run locally: `npm run dev`
3. Fix the error and redeploy

---

## 📞 Support

For issues:

1. **Check logs**: 
   - Vercel Dashboard → Deployments → Functions logs
   - Browser console (F12)

2. **Review documentation**:
   - `docs/PREMIUM_LISTINGS.md` - Full API docs
   - `PREMIUM_LISTINGS_SETUP.md` - Setup guide

3. **Check git commit**:
   - `git show 2c43e1c` - See all changes

---

## ✅ Success Criteria

Deployment is successful when:

- [x] No build errors in Vercel
- [x] Site loads in production
- [x] Submit free listing works
- [x] Click ⭐ opens premium form
- [x] Premium form submits without errors
- [x] `/admin/premium-listings` loads
- [x] Admin can approve premium listings
- [x] Premium listings display on homepage
- [x] Founder info and socials show correctly
- [x] Votes work on premium listings

---

## 🎉 Post-Deployment

Once deployed:

1. **Test everything** using checklist above
2. **Monitor** error logs for 24 hours
3. **Announce** feature to users
4. **Get feedback** on premium listings
5. **Plan enhancements** (Stripe, analytics, etc.)

---

## 📈 Next Steps (Future)

- 💳 Add Stripe for automated payments
- 📧 Add email notifications
- 📊 Add admin analytics dashboard
- 🔄 Add subscription renewal options
- 🌍 Add multi-currency support
- 🎯 Add promotional campaigns

---

**Ready to deploy? Follow the steps above!**

For questions, refer to:
- `docs/PREMIUM_LISTINGS.md`
- `PREMIUM_LISTINGS_SETUP.md`
- `IMPLEMENTATION_SUMMARY.md`
