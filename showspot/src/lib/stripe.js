const config = require('../config');

function stripeClient() {
  if (!config.stripe.secret) return null;
  // Lazy require so the app boots without the key
  const Stripe = require('stripe');
  return new Stripe(config.stripe.secret);
}

function enabled() {
  return Boolean(config.stripe.secret);
}

async function createCheckout({ booking, show, venue, showtime }) {
  const stripe = stripeClient();
  if (!stripe) throw new Error('Stripe is not configured');
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: booking.email || undefined,
    client_reference_id: String(booking.id),
    metadata: {
      booking_id: String(booking.id),
      booking_ref: booking.booking_ref,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: config.currency,
          unit_amount: Math.round(Number(booking.total) * 100),
          product_data: {
            name: `${show.title} · ${booking.booking_ref}`,
            description: `${venue.name} · ${Array.isArray(booking.seats) ? booking.seats.join(', ') : ''}`,
          },
        },
      },
    ],
    success_url: `${config.appUrl}/book/${booking.id}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.appUrl}/book/${booking.id}/checkout?cancelled=1`,
  });
  return session;
}

async function retrieveSession(sessionId) {
  const stripe = stripeClient();
  if (!stripe) return null;
  return stripe.checkout.sessions.retrieve(sessionId);
}

module.exports = { stripeClient, enabled, createCheckout, retrieveSession };
