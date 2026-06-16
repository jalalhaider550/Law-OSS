import Link from 'next/link'

export default function TermsPage() {
  const s = (size: number, weight: number = 400, color = '#0f0f0f'): React.CSSProperties => ({
    fontSize: size, fontWeight: weight, color, lineHeight: 1.7, marginBottom: 12,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: '60px', borderBottom: '1px solid rgba(0,0,0,0.08)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#0f0f0f' }}>
          <div style={{
            width: 30, height: 30, background: '#1a2e6e', borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14,
          }}>⚖</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Law <span style={{ color: '#1a2e6e' }}>OSS</span></span>
        </Link>
        <Link href="/signup" style={{
          padding: '0 16px', height: 36, display: 'inline-flex', alignItems: 'center',
          background: '#1a2e6e', borderRadius: 7, fontSize: 13.5, textDecoration: 'none', color: '#fff',
        }}>Get started free</Link>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px 80px' }}>
        <h1 style={s(32, 700)}>Terms of Service</h1>
        <p style={s(13, 400, '#888')}>Last updated: June 2025 · Beta release</p>

        {[
          {
            title: '1. Not Legal Advice',
            body: 'Law OSS is a software tool, not a law firm. Output from Law OSS AI agents does not constitute legal advice. Always consult a qualified solicitor, barrister, or attorney licensed in your jurisdiction before taking any legal action. The user is solely responsible for reviewing, verifying, and relying on any AI-generated content.',
          },
          {
            title: '2. Beta Software — Use With Caution',
            body: 'Law OSS is in beta. It may produce incorrect, incomplete, or misleading output. AI language models can hallucinate — they can generate plausible-sounding but entirely false legal citations, statutes, or analysis. Do not upload sensitive, confidential, or legally privileged documents to this platform. You assume all risk from such uploads.',
          },
          {
            title: '3. Bring Your Own Key (BYOK) Model',
            body: 'Law OSS requires you to supply your own API key from Anthropic (Claude) or Google (Gemini). Your API key is encrypted at rest using AES-256. All AI inference requests are made from our backend to the AI provider using your key. You pay the AI provider directly based on your usage. Law OSS charges you nothing for AI usage.',
          },
          {
            title: '4. Data Storage',
            body: 'Authentication and user data is handled by Supabase. Uploaded documents are stored in Supabase Storage. Conversation history may be stored to support session continuity. We do not sell your data. We do not train AI models on your data. AI providers (Anthropic, Google) process your messages according to their own terms of service.',
          },
          {
            title: '5. No Liability',
            body: 'Law OSS is provided free of charge under the MIT licence. To the maximum extent permitted by law, the authors and contributors of Law OSS disclaim all liability for any loss or damage arising from the use of this platform, including but not limited to: errors in AI output, data loss, system outages, or reliance on generated legal analysis. The liability cap is zero, as this is a free service.',
          },
          {
            title: '6. Professional Responsibility',
            body: 'If you are a legal professional using Law OSS, your professional conduct obligations (Bar, SRA, Law Society, or equivalent) remain fully in force. You are responsible for supervising AI output, ensuring accuracy, and maintaining appropriate client confidentiality. Do not upload client data without informed client consent.',
          },
          {
            title: '7. Open Source Licence',
            body: 'Law OSS is released under the MIT Licence. You are free to use, modify, and distribute the software subject to the terms of that licence. The MIT Licence does not grant any rights to use the Law OSS name or logo for commercial purposes without permission.',
          },
          {
            title: '8. Changes to Terms',
            body: 'We may update these terms as the platform evolves. Continued use of Law OSS after any update constitutes acceptance of the new terms. Material changes will be notified via the platform.',
          },
          {
            title: '9. Governing Law',
            body: 'These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.',
          },
        ].map(section => (
          <div key={section.title} style={{ marginBottom: 32 }}>
            <h2 style={s(17, 700)}>{section.title}</h2>
            <p style={s(14, 400, '#444')}>{section.body}</p>
          </div>
        ))}

        <div style={{
          background: 'rgba(26,46,110,0.05)', border: '1px solid rgba(26,46,110,0.12)',
          borderRadius: 12, padding: '20px 24px', marginTop: 40,
        }}>
          <p style={{ fontSize: 13.5, color: '#555', lineHeight: 1.6 }}>
            Questions? Open an issue on{' '}
            <a href="https://github.com" target="_blank" style={{ color: '#1a2e6e', fontWeight: 600 }}>GitHub</a>
            {' '}or email the project maintainers.
          </p>
        </div>
      </div>
    </div>
  )
}
