import { NextRequest, NextResponse } from 'next/server';
import { getPremiumListing } from '@/lib/server/premium';

interface PaymentRequest {
  premiumListingId: string;
  email: string;
  phone: string;
  name: string;
}

export async function POST(req: NextRequest) {
  try {
    const { premiumListingId, email, phone, name } = await req.json() as PaymentRequest;

    // Validate required fields
    if (!premiumListingId || !email || !phone || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // The amount comes from the bid saved at checkout, never from the browser.
    const premium = await getPremiumListing(premiumListingId);
    if (!premium || premium.payment_status !== 'pending' || !premium.amount_pkr) {
      return NextResponse.json(
        { error: 'Premium order not found or already paid' },
        { status: 404 }
      );
    }
    const amount: number = premium.amount_pkr;

    // Get Rapid Gateway credentials
    const merchantId = process.env.RAPID_GATEWAY_MERCHANT_ID;
    const clientSecret = process.env.RAPID_GATEWAY_CLIENT_SECRET;

    if (!merchantId || !clientSecret) {
      console.error('Rapid Gateway credentials not configured');
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 500 }
      );
    }

    // Step 1: Get OAuth2 Bearer Token
    const tokenUrl = 'https://secure.rapid-gateway.com/oauth2/token';
    const basicAuth = Buffer.from(`${merchantId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Rapid Gateway token error:', error);
      throw new Error('Failed to get payment gateway token');
    }

    const tokenData = await tokenResponse.json();
    const bearerToken = tokenData.access_token;

    if (!bearerToken) {
      throw new Error('No access token received from gateway');
    }

    // Generate transaction reference (BASKET_ID)
    const basketId = `${premiumListingId}-${Date.now()}`;

    // Validate phone format (should be 03XXXXXXXXX for Pakistan)
    if (!phone.match(/^03\d{9}$/)) {
      return NextResponse.json(
        { error: 'Invalid phone format. Use 03XXXXXXXXX' },
        { status: 400 }
      );
    }

    // Build the return URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Step 2: Process Transaction
    const transactionUrl = 'https://secure.rapid-gateway.com/rapid/process-transaction';

    const transactionParams = new URLSearchParams({
      MERCHANT_ID: merchantId,
      MERCHANT_NAME: process.env.RAPID_GATEWAY_MERCHANT_NAME || 'RankBid',
      TXNAMT: amount.toString(),
      CURRENCY_CODE: 'PKR',
      CUSTOMER_MOBILE_NO: phone,
      CUSTOMER_EMAIL_ADDRESS: email,
      BASKET_ID: basketId,
      TXNDESC: 'RankBid sponsored listing',
      ORDER_DATE: new Date().toISOString().split('T')[0],
      SUCCESS_URL: `${appUrl}/payment-success?basket_id=${basketId}`,
      FAILURE_URL: `${appUrl}/payment-failure?basket_id=${basketId}`,
      CHECKOUT_URL: appUrl,
      VERSION: 'MY_VER_1.0',
      PROCCODE: '0',
    });

    const transactionResponse = await fetch(transactionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: transactionParams.toString(),
      redirect: 'manual', // Don't follow redirects
    });

    // Get the redirect URL from the response
    const redirectUrl = transactionResponse.headers.get('location');

    if (!redirectUrl) {
      console.error('No redirect URL from Rapid Gateway:', transactionResponse.status);
      throw new Error('Failed to get checkout URL from payment gateway');
    }

    return NextResponse.json({
      success: true,
      redirectUrl,
      basketId,
      amount,
      message: 'Ready to redirect to payment gateway',
    });
  } catch (error: any) {
    console.error('Rapid Gateway initiate payment error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate payment. Please try again.' },
      { status: 500 }
    );
  }
}
