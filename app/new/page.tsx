import Link from 'next/link';
import { NewContractForm } from '../../components/NewContractForm.tsx';

export default function New() {
  return (
    <div className="narrow stack">
      <Link href="/" className="back">Back</Link>
      <h1>New Contract</h1>
      <div className="steps">
        <span className="s now"><span className="c">1</span>Agree</span><span className="gap">···</span>
        <span className="s"><span className="c">2</span>Fund</span><span className="gap">···</span>
        <span className="s"><span className="c">3</span>Prove</span><span className="gap">···</span>
        <span className="s"><span className="c">4</span>Pay</span>
      </div>
      <p className="muted">Split the work into milestones. Each gets a price and the criteria the AI referee will check it against.</p>
      <NewContractForm />
    </div>
  );
}
