import { useParams } from 'react-router-dom'

const copy: Record<string, { title: string; body: string[] }> = {
  privacy: {
    title: 'Privacy',
    body: [
      'FORGE stores only what it needs to run your cart and wishlist on this device. Account forms in this demo do not send data to a server.',
      'We do not sell personal information. If you join the newsletter in a production environment, we would use your email only for drops and training notes.',
    ],
  },
  terms: {
    title: 'Terms',
    body: [
      'This storefront is a demonstration experience. Products, prices, and checkout are simulated. No real payment is processed.',
      'Limited drops, sale items, and worn goods have specific return rules as stated on each product page.',
    ],
  },
  shipping: {
    title: 'Shipping',
    body: [
      'Metro cities arrive in 2–4 business days. The rest of India in 4–7. Orders over ₹2,499 ship free.',
      'You will receive a tracking link when the order leaves the warehouse. This demo does not dispatch real parcels.',
    ],
  },
  returns: {
    title: 'Returns',
    body: [
      'Unworn items with tags can be returned within 14 days for a refund to the original method.',
      'Sale items and limited drops are final unless they arrive defective. Contact support with photos and the order ID.',
    ],
  },
}

export function Legal() {
  const { slug = 'privacy' } = useParams()
  const page = copy[slug] ?? copy.privacy
  return (
    <div className="page">
      <div className="page-hero">
        <div className="container">
          <p className="kicker">Legal</p>
          <h1 className="display">{page.title}</h1>
        </div>
      </div>
      <div className="container" style={{ maxWidth: 720, padding: '40px 0 80px' }}>
        {page.body.map((p) => (
          <p key={p} style={{ color: 'var(--muted)', marginBottom: 16 }}>
            {p}
          </p>
        ))}
      </div>
    </div>
  )
}
