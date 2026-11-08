import Link from 'next/link';
import { NewContractForm } from '../../components/NewContractForm.tsx';
import { BlurText, Rise } from '../../components/Motion.tsx';
import { Back } from '../../components/Icons.tsx';

export default function New() {
  return (
    <>
      <section className="balance-row">
        <div>
          <div className="welcome"><span className="chip">1 / 5</span></div>
          <div className="big-money" style={{ fontSize: 'clamp(44px, 6vw, 84px)' }}><BlurText text="New escrow" /></div>
        </div>
        <div className="actions"><Link href="/" className="act"><Back />Back</Link></div>
      </section>
      <div className="grid">
        <div className="col"><NewContractForm /></div>
        <div className="col">
          <Rise><div className="track" style={{ cursor: 'default' }}>
            <div className="title">How it works <span className="live">PayPal</span></div>
            <div className="line" style={{ marginTop: 26 }}>
              {['Agree', 'Fund', 'Prove', 'Pay'].map((s, i) => <span key={s} className={`st ${i === 0 ? 'now' : ''}`}><i />{s}</span>)}
            </div>
            <div className="foot"><span>Held, not taken</span><span><b>AI</b> checks · you pay</span></div>
          </div></Rise>
        </div>
      </div>
    </>
  );
}
