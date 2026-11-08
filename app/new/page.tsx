import { NewContractForm } from '../../components/NewContractForm.tsx';
import { Faqs } from '../../components/Escrow.tsx';
import { Spark, Shield, Wallet } from '../../components/Icons.tsx';

export default function New() {
  return (
    <div className="page" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 400px)' }}>
      <div className="col">
        <div className="stack" style={{ gap: 10 }}>
          <h1>Start an escrow</h1>
          <div className="steps">
            <span className="s now"><span className="c">1</span>Agree</span><span className="gap">··</span>
            <span className="s"><span className="c">2</span>Fund</span><span className="gap">··</span>
            <span className="s"><span className="c">3</span>Prove</span><span className="gap">··</span>
            <span className="s"><span className="c">4</span>Pay</span><span className="gap">··</span>
            <span className="s"><span className="c">5</span>Settle</span>
          </div>
        </div>
        <NewContractForm />
      </div>
      <div className="col">
        <div className="hero">
          <div className="label">How the money moves</div>
          <div className="big"><span>Held → Proven → Paid</span></div>
          <div className="divider" />
          <div className="foot"><Wallet /> PayPal holds the total. Nothing is taken until you release it.</div>
        </div>
        <div className="item"><div><div>Write criteria a stranger could check</div><div className="dim">“Deployed to a public URL” beats “looks good”. The AI can sharpen them for you.</div></div><span className="ic"><Spark /></span></div>
        <div className="item"><div><div>The freelancer sees the money first</div><div className="dim">Once funded, they know it exists before they start.</div></div><span className="ic"><Shield /></span></div>
        <Faqs />
      </div>
    </div>
  );
}
