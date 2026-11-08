import Link from 'next/link';
import { NewContractForm } from '../../components/NewContractForm.tsx';
import { Faqs } from '../../components/Escrow.tsx';
import { Back } from '../../components/Icons.tsx';

export default function New() {
  return (
    <>
      <section className="balance-row">
        <div>
          <div className="welcome">New escrow · Agree → Fund → Prove → Pay → Settle <span className="chip">Step 1 of 5</span></div>
          <div className="big-money" style={{ fontSize: 'clamp(44px, 6vw, 84px)' }}>Pay on proof<span className="c">.</span></div>
        </div>
        <div className="actions"><Link href="/" className="act"><Back />Escrows</Link></div>
      </section>
      <div className="grid">
        <div className="col"><NewContractForm /></div>
        <div className="col">
          <div className="track" style={{ cursor: 'default' }}>
            <div className="title">How the money moves <span className="live">PayPal</span></div>
            <div className="body"><div className="count">3<small>steps</small></div>
              <div style={{ fontStyle: 'italic', fontSize: 15 }}>The total is held in PayPal. The AI referee checks each delivery. You release exactly what&rsquo;s proven — the rest goes back.</div>
            </div>
          </div>
          <Faqs />
        </div>
      </div>
    </>
  );
}
